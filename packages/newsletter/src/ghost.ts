import type { NewsletterProvider, OptInRequest, SyncOutcome } from "./types";
import { labelsFor, type GhostInstance } from "./config";

/**
 * Ghost-native implementation of {@link NewsletterProvider}.
 *
 * Uses Ghost's public members endpoint — the same one the Portal script drives
 * behind the `data-members-email` signup pattern:
 *
 *   POST {ghostUrl}/members/api/send-magic-link/
 *   { email, emailType: "signup", name?, labels[], newsletters?, autoRedirect }
 *
 * This is inherently **double opt-in**: Ghost creates the member and emails a
 * magic link the visitor must click to confirm. That confirmation email is
 * transactional and depends on the instance's SMTP being wired — the POST here
 * succeeds (member created, unconfirmed) regardless, so this package is not
 * blocked on SMTP, but end-to-end confirmation is (see README + the
 * transactional SMTP task).
 *
 * The endpoint is idempotent by email: re-signing an existing address re-sends
 * the link and merges labels rather than duplicating the member. It does not
 * return a member id, so SyncOutcome.id is left undefined on success.
 */
export function createGhostNewsletterProvider(
  instance: GhostInstance,
  fetchImpl: typeof fetch = fetch,
): NewsletterProvider {
  return {
    async subscribe(request: OptInRequest): Promise<SyncOutcome> {
      const labels = labelsFor(request);

      const body: Record<string, unknown> = {
        email: request.email,
        emailType: "signup",
        labels,
        // Headless: never bounce the visitor's browser to the Ghost domain.
        autoRedirect: false,
      };
      if (request.name) body.name = request.name;
      if (instance.newsletters?.length) {
        body.newsletters = instance.newsletters.map((id) => ({ id }));
      }

      let response: Response;
      try {
        response = await fetchImpl(
          `${instance.url}/members/api/send-magic-link/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
          },
        );
      } catch (err) {
        return { ok: false, error: `ghost request failed: ${errMsg(err)}` };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          error: `ghost ${response.status} ${response.statusText}${
            text ? ` — ${text.slice(0, 300)}` : ""
          }`,
        };
      }

      // send-magic-link returns 201 "Created." with no member id; some builds
      // return a JSON body. Treat any 2xx as success and surface an id if given.
      const id = await extractId(response);
      return id ? { ok: true, id } : { ok: true };
    },
  };
}

async function extractId(response: Response): Promise<string | undefined> {
  const ctype = response.headers.get("content-type") ?? "";
  if (!ctype.includes("application/json")) return undefined;
  try {
    const json = (await response.json()) as {
      id?: string | number;
      member?: { id?: string | number };
    };
    const id = json.member?.id ?? json.id;
    return id != null ? String(id) : undefined;
  } catch {
    return undefined;
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
