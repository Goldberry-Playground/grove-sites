import type { NewsletterProvider, OptInRequest, SyncOutcome } from "./types";
import { resolveGroupIds, type MailerLiteConfig } from "./config";

/** Shape MailerLite returns from POST /api/subscribers. */
interface MailerLiteSubscriberResponse {
  data?: { id?: string | number };
}

/**
 * MailerLite implementation of {@link NewsletterProvider}.
 *
 * Uses the v2 "connect" API. `POST /subscribers` is an upsert keyed by email —
 * re-subscribing an existing address merges the new groups/fields instead of
 * creating a duplicate, which is exactly the idempotency the capture surfaces
 * rely on.
 */
export function createMailerLiteProvider(
  config: MailerLiteConfig,
  fetchImpl: typeof fetch = fetch,
): NewsletterProvider {
  return {
    async subscribe(request: OptInRequest): Promise<SyncOutcome> {
      const groups = resolveGroupIds(config, request.brand, request.interests);

      const fields: Record<string, string> = {};
      if (request.name) fields.name = request.name;
      // Persist attribution as custom fields where present, so the newsletter
      // side keeps the same signup context the CRM gets.
      if (request.attribution) {
        for (const [k, v] of Object.entries(request.attribution)) {
          if (typeof v === "string" && v) fields[k] = v;
        }
      }

      const body = {
        email: request.email,
        fields,
        groups,
        // `unconfirmed` triggers MailerLite's double opt-in confirmation email;
        // `active` skips it. Governed by config so CMO can flip it per policy.
        status: config.doubleOptIn ? "unconfirmed" : "active",
      };

      let response: Response;
      try {
        response = await fetchImpl(`${config.baseUrl}/subscribers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        return { ok: false, error: `mailerlite request failed: ${errMsg(err)}` };
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          error: `mailerlite ${response.status} ${response.statusText}${
            text ? ` — ${text.slice(0, 300)}` : ""
          }`,
        };
      }

      const json = (await response
        .json()
        .catch(() => ({}))) as MailerLiteSubscriberResponse;
      const id = json.data?.id;
      return { ok: true, id: id != null ? String(id) : undefined };
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
