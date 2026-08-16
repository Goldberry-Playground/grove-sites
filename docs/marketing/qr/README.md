# Nursery onsite signup QR (v3) — GOL-336

Print masters for the At the Grove Nursery onsite signup QR code.

- **Encodes:** `https://atthegrovenursery.com/notify?src=qr-onsite`
- **Target route:** `apps/nursery/app/notify/page.tsx` (this repo) — a focused
  newsletter signup that logs `src=qr-onsite` attribution via
  `CaptureForm.collectAttribution()`. List of record: nursery Ghost, label
  `nursery-general`.
- **Color:** Forest Command `#617333` modules on white.
- **Error correction:** level H (high — survives smudge/partial damage on printed placards).
- **Files:** `nursery-signup-qr-v3.svg` (vector, preferred for print) and
  `nursery-signup-qr-v3.png` (1200px, level-H, margin 4).

Supersedes v2 (`…avNoK4qdRGLA` Google Form). Do not print until the `/notify`
route is deployed and returns 200 (PR that adds it: GOL-336). Decode-verified
round-trips to the exact URL above.

Regenerate deterministically:

```
npx qrcode "https://atthegrovenursery.com/notify?src=qr-onsite" \
  -o nursery-signup-qr-v3.png -e H -m 4 -w 1200 -d '#617333' -l '#ffffff'
```
