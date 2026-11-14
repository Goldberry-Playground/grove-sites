import type { PlannerRole, Site, Slot, Stratum, Subgoal, Succession, Timing, Track } from "@grove/planner";

/**
 * Every customer-facing string on the order builder, in one place so the
 * brand-voice guard can scan it and so the home teaser and the /plan page can
 * never drift. Plain, neighborly, no em dashes (GOL-589).
 */

export const PLAN_EYEBROW = "Plant a community";
/** Shown beside the eyebrow on /plan and the home teaser while the planner is new (Josh 2026-11-03). */
export const PLAN_EXPERIMENTAL_TAG = "Experimental";
export const PLAN_EXPERIMENTAL_NOTE =
  "This is a new tool and we are still adding plants to it. If your plan comes up short, browse the shop or ask us and we will help you choose.";
export const PLAN_HEADING = { lead: "One patch of ground,", em: "planted as a community." };
export const PLAN_LEDE =
  "Tell us where you are planting and what you want from it. We pick anchors that will stand for a lifetime, companions that feed the soil while they grow, and we size it for your spot. Change any line before it goes in the cart.";

/** Josh 2026-11-06: polyculture first, never "answer four questions, we build your order". */
export const HOME_TEASER_HEADING = { lead: "Plant a grove,", em: "not a row." };
export const HOME_TEASER_LEDE = "Say where it goes and what it is for. We put together the layers.";

export const QUESTIONS = {
  where: "Where are you planting?",
  spot: "What is the spot like?",
  goal: "What are you trying to do?",
  when: "When do you want a harvest?",
} as const;

export const ZIP_LABEL = "ZIP code";
export const ZIP_HINT = "Five digits. We look up your USDA zone from it.";
export const ZIP_LOOKING = "Looking up your zone";
export const ZIP_UNKNOWN = "We could not place that ZIP. Pick your state and we will plan on its zone range.";
export const ZIP_ERROR = "The zone lookup is not answering. Pick your state instead.";
export const STATE_LABEL = "State";
export const STATE_PLACEHOLDER = "Choose a state";
export const STATE_UNSUPPORTED_HEADING = "We cannot ship there yet.";
export const STATE_UNSUPPORTED_BODY =
  "Our nursery licence covers the states in our ship-to list, and yours is not on it yet. You are welcome to order for pickup at the nursery in West Virginia, or leave an address and we will tell you when your state opens.";
export const STATE_UNSUPPORTED_PICKUP = "Browse for farm pickup";

export const SITES: Record<Site, { label: string; detail: string }> = {
  open: { label: "Open ground", detail: "Full sun, drains well" },
  wet: { label: "Low, wet spot", detail: "Holds water after a rain" },
  poor: { label: "Rough ground", detail: "Rocky, clay, or thin soil" },
  shade: { label: "Woods edge", detail: "Shade part of the day" },
};

export const TRACKS: Record<Track, { label: string; detail: string }> = {
  food: { label: "Grow food for my family", detail: "Nuts, fruit, and the plants that help them along" },
  agro: { label: "Put my land to work", detail: "Alley crops, silvopasture, buffers, windbreaks" },
  deer: { label: "Bring in deer and wildlife", detail: "A plot that drops something all season" },
};

export const SUBGOALS: Record<Subgoal, string> = {
  alley: "Alley crop rows",
  silvo: "Silvopasture",
  riparian: "Riparian buffer",
  windbreak: "Windbreak or hedgerow",
};
export const SUBGOAL_QUESTION = "What kind of planting?";

export const SIZE_QUESTION = "How many trees?";
export const SIZE_LABELS: Record<Track, Record<number, { label: string; detail: string }>> = {
  food: {
    5: { label: "Corner", detail: "5 trees" },
    20: { label: "Homestead", detail: "20 trees" },
    50: { label: "Acre", detail: "50 trees" },
    100: { label: "Full acre", detail: "100 trees" },
  },
  agro: {
    50: { label: "50 trees", detail: "A first block" },
    100: { label: "100 trees", detail: "A full planting" },
  },
  deer: {
    8: { label: "One stand", detail: "8 trees" },
    16: { label: "Daily plot", detail: "16 trees" },
    30: { label: "Orchard", detail: "30 trees and up" },
  },
};
export const AGRO_MORE_LABEL = "More than 100";
export const AGRO_MORE_DETAIL = "Talk to us";

export const TIMINGS: Record<Timing, { label: string; detail: string }> = {
  fast: { label: "Fast", detail: "First crop within 5 years" },
  patient: { label: "Patient", detail: "Long-lived canopy nuts" },
  mixed: { label: "Mixed", detail: "A bit of both, our default" },
  early: { label: "Early season", detail: "September to October" },
  late: { label: "Late season", detail: "December to February" },
  all: { label: "All season", detail: "Both, our default" },
  year: { label: "All year", detail: "Something every month we can" },
};

/**
 * The four layers as the planting reads top-down (Josh 2026-11-06, after
 * growperma.com/blog/food-forest-canopy-trees-choosing-your-overstory):
 * overstory, midstory, shrub, ground. The engine's slot keys are unchanged.
 */
export const SLOT_LABELS: Record<Slot, string> = {
  canopy: "Overstory",
  understory: "Midstory layer",
  shrub: "Shrub layer",
  support: "Support",
  mushroom: "Ground layer",
  early: "Early season",
  late: "Late season",
  offseason: "Off season",
};

// ── Winter beta (planner-winter-beta spec §C, GOL-3550) ─────────────────────

/** The philosophy line above the lines (spec, decisions: stated on the page). */
export const PHILOSOPHY =
  "Anchors are the long-lived trees the planting is built around. Companions feed the soil, the pollinators and you while the anchors grow, and their prunings become mulch and mushroom logs. Nothing here is planted alone.";

export const STRATUM_LABELS: Record<Stratum, string> = {
  overstory: "Overstory",
  midstory: "Midstory",
  shrub: "Shrub",
  ground: "Ground layer",
};
/** One line under each layer in the strip: what the layer does in the planting. */
export const LAYER_NOTES: Partial<Record<Slot, string>> = {
  canopy: "The tall trees that set the structure for everything below. Chosen first: they decide what grows under them for the next 30 to 80 years.",
  understory: "Smaller trees beneath the overstory. They add density and catch the sun that gets through.",
  shrub: "Nuts and berries at arm height. They fill the gaps and crop while the trees come up.",
  mushroom: "Mushrooms, wildflowers, ferns and medicinal plants like ginseng, living on the shade and the prunings.",
};
export const ROLE_LABELS: Record<PlannerRole, string> = {
  anchor: "anchor",
  companion: "companion",
};
/** "Overstory anchor", "Midstory companion", "Ground layer anchor". */
export const stratumRole = (stratum: Stratum | null, role: PlannerRole | null): string | null => {
  if (stratum && role) return `${STRATUM_LABELS[stratum]} ${ROLE_LABELS[role]}`;
  if (stratum) return STRATUM_LABELS[stratum];
  if (role) return role === "anchor" ? "Anchor" : "Companion";
  return null;
};
export const SUCCESSION_LABELS: Record<Succession, string> = {
  fast: "fast",
  mid: "mid",
  long: "long-lived",
};
export const FIXES_N = "fixes N";
export const FIXES_N_TITLE = "Fixes nitrogen in the soil";
export const NEEDS_REVIEW = "Needs review";
export const NEEDS_REVIEW_TITLE = "Our testers have questioned a fact on this plant. We are checking it.";
export const GROWS_ON = (substrate: string) => `Grows on ${substrate}`;
export const YOUR_PICK = "your pick";
export const MARGINAL_ZONE = "Marginal for your zone";

export const SWAP_LINE = "Swap";
export const SWAP_NONE = (slotLabel: string) => `Nothing else we grow fits the ${slotLabel.toLowerCase()} slot on this ground.`;
export const SWAPPED_FOR = (from: string, to: string) => `Swapped ${from} for ${to}.`;

export const SAVE_HEADING = "Save this plan";
export const SAVE_LEDE = "Give it a name and we keep a copy at the nursery. Your answers stay in the link above either way.";
export const SAVE_NAME_LABEL = "Plan name";
export const SAVE_NAME_PLACEHOLDER = "The back field";
export const SAVE_BUTTON = "Save this plan";
export const SAVE_SAVING = "Saving";
export const SAVE_DONE = (name: string) => `Saved as "${name}". We have a copy at the nursery.`;
export const SAVE_NAME_REQUIRED = "Give the plan a name first.";
export const SAVE_FAILED = "We could not save that just now. Your plan is still here; try again in a minute.";
export const SAVE_OFF = "Saving plans is paused for the moment. Your plan is still here in the link.";

export const SUGGESTED_HEADING = "Also fits your ground";
export const SUGGESTED_LEDE =
  "Everything else we grow that suits your zone and your spot, by layer. Add what you know you want; we learn from it.";
export const SUGGESTED_EMPTY = "Your plan already has everything we grow for this spot.";
export const SUGGESTED_ADD = "Add";
export const SUGGESTED_ADDED = (name: string) => `Added ${name} to your plan.`;
export const SUGGESTED_HIDDEN = (n: number) =>
  n === 1 ? "1 plant we grow is hidden because it does not suit this site." : `${n} plants we grow are hidden because they do not suit this site.`;
export const ZONE_FIT_SAFE = "In your zone";
export const ZONE_FIT_MARGINAL = "Marginal";
export const HARVEST_LABEL = "Harvest";
export const YEARS_LABEL = (n: number) => (n === 1 ? "1 year to first crop" : `${n} years to first crop`);

export const SUGGEST_HEADING = "Should we grow something else?";
export const SUGGEST_LEDE = "If a plant belongs in your plan and we do not carry it, tell us. Josh reads every one.";
export const SUGGEST_NAME_LABEL = "Plant name";
export const SUGGEST_NAME_PLACEHOLDER = "Che, honeyberry, groundnut";
export const SUGGEST_STRATUM_LABEL = "Which layer";
export const SUGGEST_STRATUM_ANY = "Not sure";
export const SUGGEST_NOTE_LABEL = "Why it belongs";
export const SUGGEST_NOTE_HINT = "A sentence or two is plenty. Where it grows for you, what it does in the planting.";
export const SUGGEST_BUTTON = "Send";
export const SUGGEST_SENDING = "Sending";
export const SUGGEST_DONE = "Thank you. It goes to the nursery for review, and if we take it on it will show up here.";
export const SUGGEST_NAME_REQUIRED = "Tell us the plant's name.";
export const SUGGEST_FAILED = "That did not go through. Try again in a minute, or email us.";
export const SUGGEST_OFF = "Suggestions are paused for the moment. Email us instead.";
export const SUGGEST_LIMIT = "That is plenty for one hour. Thank you; try again later.";

/** The site as it reads inside a sentence ("fits a low, wet spot"). */
export const SITE_NOUN: Record<Site, string> = {
  open: "open ground",
  wet: "a low, wet spot",
  poor: "rough ground",
  shade: "a woods edge",
};

export const TRACK_NOUN: Record<Track, string> = {
  food: "food forest",
  agro: "planting",
  deer: "deer plot",
};

export const SEE_PLAN = "See my plan";
export const EDIT_ANSWERS = "Edit answers";
/** One button, the whole planting as one pre-order (Josh 2026-11-06: nothing is "potted"; package it together). */
export const BUILD_ORDER = "Add the whole planting to my cart";
export const TALK_FIRST = "Talk it through first";
export const RESET_PLAN = "Reset to our mix";
export const REMOVE_LINE = "Remove";
export const NOTIFY_ME = "Notify me";
export const BACK_SOON = "back in stock soon";
export const USE_BUNDLE = "Use the bundle";
export const START_FROM_MIX = "Start from this mix";

export const CATALOG_LOADING = "Loading what we grow";
export const CATALOG_ERROR = "We could not load the catalog just now.";
export const RETRY = "Try again";
export const TRY_OPEN_GROUND = "Try open ground instead";

export const CONSULT_HEADING = "Talk it through first";
export const CONSULT_BODY =
  "A planting this size is worth an hour with us. Add the free planting consult at checkout and we will walk the plan with you before anything ships, or reach us directly:";

export const SHIP_WINDOW_FALLBACK =
  "Everything ships dormant in your zone's window; the exact dates show at checkout.";
export const WAVES_CLOSED = (zone: number) =>
  `Bareroot pre-orders for zone ${zone} are closed right now. They open September 1 for the fall wave and November 1 for spring. Add your email to the lines below and we will say when.`;

// ── Tester bench (winter-beta spec §C.4, GOL-3551). Testers only; plain words. ──
export const BENCH_EYEBROW = "Tester bench";
export const BENCH_HEADING = "How this plan was scored";
export const BENCH_LEDE =
  "Only testers see this. Moving a slider re-runs the plan on this page and nowhere else. Nothing changes for anyone until you propose a weight and the nursery accepts it.";
export const BENCH_LINES_HEADING = "Score per line";
export const BENCH_WEIGHTS_HEADING = "What-if weights";
export const BENCH_WEIGHTS_LEDE = "Try a weight here first. Propose it once the plan reads right to you.";
export const BENCH_RESET_ALL = "Reset all weights";
export const BENCH_RESET_ONE = (label: string) => `Reset ${label.toLowerCase()}`;
export const BENCH_LIVE = (value: string) => `Live value ${value}`;
export const BENCH_TOTAL = "Score";
export const BENCH_WAS = (value: string) => `was ${value}`;
export const BENCH_SAME_PICKS = "With these weights the plan picks the same plants.";
export const BENCH_PICKS_HEADING = "With these weights the plan would pick";
export const BENCH_PICK_CHANGE = (slot: string, now: string, was: string) => `${slot}: ${now} instead of ${was}`;
export const BENCH_PICK_NONE = "nothing";
export const BENCH_PROPOSE = "Propose this weight";
export const BENCH_PROPOSING = "Sending";
export const BENCH_PROPOSED = (label: string, value: string) => `Proposed ${label.toLowerCase()} at ${value}. It goes to the nursery for review.`;
export const BENCH_DISPUTE = "Dispute a fact";
export const BENCH_DISPUTE_LEGEND = (name: string) => `Which fact about ${name} is wrong?`;
export const BENCH_DISPUTE_NOTE = "What you have seen";
export const BENCH_DISPUTE_NOTE_HINT = "Where you grow it and what it did. A sentence is plenty.";
export const BENCH_DISPUTE_SEND = "Send dispute";
export const BENCH_DISPUTE_SENDING = "Sending";
export const BENCH_DISPUTE_PICK = "Pick the fact you think is wrong.";
export const BENCH_DISPUTED = (fact: string) => `Thank you. Your note on ${fact.toLowerCase()} is with the nursery.`;
export const BENCH_FAILED = "That did not go through. Try again in a minute.";
export const BENCH_OFF = "The tester bench is paused for the moment.";
export const BENCH_LIMIT = "That is plenty for one hour. Try again later.";
export const BENCH_NOT_TESTER = "Your tester link has expired. Ask Josh for a fresh one.";
export const BENCH_UNSET = "not set";
export const BENCH_YES = "yes";
export const BENCH_NO = "no";
export const BENCH_FACT_LABELS: Record<string, string> = {
  zone_min: "Coldest zone",
  zone_max: "Warmest zone",
  years_to_fruit: "Years to first crop",
  tolerates_wet: "Takes wet ground",
  tolerates_poor_soil: "Takes poor soil",
  tolerates_shade: "Takes shade",
  pollination: "Plants to pollinate",
  harvest_months: "Harvest months",
  role: "Role",
  succession: "Succession",
  stratum: "Layer",
};
