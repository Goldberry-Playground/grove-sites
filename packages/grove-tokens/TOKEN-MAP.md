# Token map — bespoke app tokens → `--grove-*` semantic roles

When lifting a component into `@grove/ui-kit`, **replace every `var(--<bespoke>)` in its
CSS with the `var(--grove-*)` role below.** The component then themes across all four
brands automatically. Decorative brand-specific nuance (a green `--moss` becoming the
brand accent) is intentionally sacrificed for themeability — that's the design-system tradeoff.

| Role (`--grove-*`) | Maps from these app tokens |
|---|---|
| `--grove-color-primary` | `--chestnut-reserve`, `--walnut`, `--bark`, `--forest`, `--color-primary`, `--gg-walnut`, `--nu-forest`, `--timber`, `--midnight-bark` |
| `--grove-color-primary-deep` | `--chestnut-reserve-deep`, `--walnut-deep`, `--forest-deep`, `--timber-grain`, `--brown-deep` |
| `--grove-color-primary-foreground` | `--color-primary-foreground` (text/icons sitting ON a primary surface) |
| `--grove-color-secondary` | `--harvest-gold`, `--cherry`, `--leaf`, `--color-secondary` |
| `--grove-color-secondary-foreground` | `--color-secondary-foreground` |
| `--grove-color-accent` | `--forest-command`, `--amber`, `--orange`, `--color-accent`, `--moss`, `--sage`, `--sap`, `--leaf-deep`, `--moss-soft` |
| `--grove-color-ink` | `--ink`, `--color-foreground`, `--charcoal` (as body text) |
| `--grove-color-ink-soft` | `--ink-soft`, `--walnut-light`, `--brown`, `--iron`, `--iron-rust`, `--fog`, `--moss-deep` (muted/secondary text) |
| `--grove-color-paper` | `--ivory-mist`, `--bone`, `--parch`, `--parchment`, `--paper`, `--cream`, `--color-background`, `--plank-pale` |
| `--grove-color-paper-deep` | `--ivory-mist-deep`, `--bone-deep`, `--parch-deep`, `--paper-deep`, `--cream-deep`, `--plank`, `--plum` (as a sunk band → prefer plum role) |
| `--grove-color-paper-soft` | `--ivory-mist-soft`, `--bone-soft`, `--parch-soft`, `--paper-soft`, `--cream-soft`, `--plank-light` |
| `--grove-color-plum` | `--plum`, `--gb-plum`, `--plum-mist` |
| `--grove-color-plum-deep` | `--plum-deep` |
| `--grove-color-gold` | `--gold`, `--gold-deep`, `--harvest-gold-deep` |
| `--grove-space-grid` | `--grid` |
| `--grove-font-display` | `--font-display` |
| `--grove-font-body` | `--font-body`, `--font-sans` |
| `--grove-font-mono` | `--font-mono` |

## Rules
- **Never** leave a raw hex or a `--<bespoke>` token in a lifted component's CSS — every value comes through a `--grove-*` role.
- If a token genuinely has no role above, STOP and report it to the orchestrator (don't invent a new `--grove-*` token — the contract is fixed).
- `--grid` is identical across all four apps; it's a layout constant → `--grove-space-grid`.
- VendorCard's per-sub-brand accent (set inline via `style={{borderTopColor}}`) stays a **prop**, not a token.
