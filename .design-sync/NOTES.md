# design-sync notes

Four Claude Design projects, one per brand — SAME @grove/ui-kit bundle, different theme.

| Brand | projectId | config |
|---|---|---|
| Goldberry Grove | 937e8bd2-8fdb-4e4f-8181-b69e91b067f2 | config.goldberry.json |
| GGG Woodworking | 5fb4ebf9-3865-4679-bd67-9bdbcb09525b | config.ggg.json |
| At the Grove Nursery | 3fde251b-68f7-4b88-b4eb-4ebb6eb2e767 | config.nursery.json |
| Gather at the Grove | 49cf4144-c527-4831-a446-dbfc30a452ef | config.hub.json |

## Per-brand themed CSS
`packages/grove-ui/ds-theme.<brand>.css` = Google-Fonts @import + grove-tokens contract + that brand's theme, concatenated. REGENERATE if grove-tokens change (see the loop in the commit that added these).

## Build per brand (Node 22 — `fnm use 22`)
    node .ds-sync/package-build.mjs --config .design-sync/config.<brand>.json \
      --node-modules packages/grove-ui/node_modules --entry ./packages/grove-ui/dist/index.js --out ./ds-bundle
    node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check

## Re-sync risks / TODO (path A)
- Renders were NOT machine-verified (no chromium; --no-render-check). Install playwright+chromium before path A to verify previews.
- Button ships a FLOOR CARD (preview unauthored). Author .design-sync/previews/Button.tsx (+ the lifted components) on path A.
- Fonts load at runtime via Google-Fonts @import ([FONT_REMOTE]); brand serif "Baskerville Classico" is paid → web fallback Libre Baskerville is used.
- ds-theme.<brand>.css duplicates grove-tokens content — regenerate on token change.
