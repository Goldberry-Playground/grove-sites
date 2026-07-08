# Evaluation: baking Chromium deps into the base image

**Issue:** GOL-119 (durability follow-up to GOL-110) · **Author:** DevOps-Terra · **Status:** evaluation, one action to route

## TL;DR

The rootless prefix in this directory is a workaround for a base image that lacks browser
system libraries. The permanent fix is to install the Playwright dependency set **once, at
image-build time, as root** — where `apt` works normally and no `LD_LIBRARY_PATH` /
`dpkg -x` gymnastics are needed. There are **two** images in play:

| Image | Owner | Can we edit it here? | Recommendation |
|---|---|---|---|
| **Agent / preview runtime base** (what agents actually run in) | Paperclip platform | **No** — not in these repos | **Route a request to the platform owner** to add the dep layer. This is the real permanent fix. |
| **`.sandcastle/Dockerfile`** (grove-sites Sandcastle runner) | This repo (agent-owned) | **Yes** | **Do not bake by default.** Snippet provided below; enable only if/when Sandcastle agents must render. |

Until the platform base image ships the deps, `tools/browser-runtime/` remains the supported
path and this stays a workaround — not a snowflake, because it is now codified and idempotent.

---

## Why the rootless prefix exists (the constraint we're removing)

The current agent image is Debian 13 (trixie) with `node`/`npm`/`curl`/`dpkg` but:

1. **No browser libs** — `libglib-2.0.so.0`, `libnss3`, `libgbm1`, `libnspr4`, etc. are absent.
2. **uid 1000, no sudo** — an agent cannot `apt-get install` at runtime.
3. **Stale apt index** — `apt-get download` fails with a `libc6` version mismatch.

So `bootstrap.sh` bypasses apt: it curls exact `.deb` URLs from the trixie pool, `dpkg -x`
extracts them into a userspace `libs/` prefix, and points `LD_LIBRARY_PATH` at it. It works,
but it costs ~1.1 GB on the shared volume and a multi-minute first build per fresh filesystem.

**Every one of those three constraints disappears at image-build time**, because the build runs
as root before the unprivileged agent user is created. That is why the base image is the
correct place to fix this.

---

## Option A — Agent/preview base image (RECOMMENDED, platform-owned)

**Blast radius:** every agent, everywhere — no per-workspace prefix, no shared-volume bloat,
no runtime egress to `deb.debian.org`. This is the permanent fix.

Add one layer to the platform base Dockerfile, as root, before the unprivileged user is created:

```dockerfile
# Playwright system deps for headless Chromium (root, build-time).
# Pin the Playwright version to match tools/browser-runtime/package.json so the dep
# set install-deps resolves matches the browser the runtime actually launches.
RUN npx --yes playwright@1.61.1 install-deps chromium
# Optional: also bake the browser binary so no per-workspace `playwright install` is needed.
# RUN npx --yes playwright@1.61.1 install chromium
```

Notes for the platform owner:
- `install-deps chromium` pulls the **exact** apt package set Playwright needs — it is the
  upstream-maintained list, so it self-heals across Chromium bumps (no hand-curated lib list).
- Cost: ~300–400 MB added to the base image layer. Amortized across all agents; far cheaper
  than ~1.1 GB per workspace prefix.
- After this ships, `bootstrap.sh`'s lib-resolution steps become no-ops (the libs are already
  on the default loader path), and `activate.sh`'s `LD_LIBRARY_PATH` export is harmless/unneeded.
  We keep this directory as the fallback for images that don't yet have the deps.
- **This repo cannot make this change** — the base image Dockerfile is not in grove-sites or
  AgenticOS. It must be filed against the Paperclip platform. See "Action to route" below.

## Option B — `.sandcastle/Dockerfile` (in-repo, agent-owned, NOT recommended by default)

`.sandcastle/Dockerfile` builds the container for the Sandcastle backlog runner. It already
`apt-get install`s tools as root and then drops to `USER agent`, so baking Chromium deps is a
one-line insert **before** the `USER agent` line:

```dockerfile
# --- OPTIONAL: headless-Chromium rendering for Sandcastle agents ---
# Only enable if Sandcastle agents must visually verify frontend issues.
# Adds ~300-400 MB to the image. Insert BEFORE `USER agent`.
RUN npx --yes playwright@1.61.1 install-deps chromium \
 && npx --yes playwright@1.61.1 install chromium
```

**Recommendation: leave it off for now.** Rationale:
- Sandcastle is a *code-implementation* runner (implement → review → PR). The large majority of
  its issues are non-visual; most runs would pay the ~300–400 MB image cost for nothing.
- Sandcastle commits go through CI + a reviewer agent + human squash-merge — visual verification
  is not currently part of that loop.
- If a wave of frontend-heavy Sandcastle work appears, flip it on: uncomment the block above,
  rebuild the image (`pnpm exec sandcastle docker build-image`), done. It's a two-minute change,
  fully reversible, and self-contained in this repo.

We deliberately provide the snippet rather than committing it commented-out into the Dockerfile,
to keep the Dockerfile clean.

---

## Decision & action to route

1. **Permanent fix (Option A)** — file a request against the **Paperclip platform base image**
   to add `RUN npx --yes playwright@1.61.1 install-deps chromium` (owner: platform / route via
   CEO). Tracked as a GOL-119 child issue.
2. **Sandcastle (Option B)** — no change now; snippet documented above, enable on demand.
3. **This directory** — remains the supported, codified fallback until (1) ships.
