import type { Site, Slot, Subgoal, Timing, Track } from "@grove/planner";

/**
 * Every customer-facing string on the order builder, in one place so the
 * brand-voice guard can scan it and so the home teaser and the /plan page can
 * never drift. Plain, neighborly, no em dashes (GOL-589).
 */

export const PLAN_EYEBROW = "Order builder";
export const PLAN_HEADING = { lead: "Four questions.", em: "One planted order." };
export const PLAN_LEDE =
  "Tell us where you are planting and what you want from it. We will put together a mix from what we grow, sized for your spot, and you can change any line before it goes in the cart.";

export const HOME_TEASER_HEADING = "Need help choosing trees?";
export const HOME_TEASER_LEDE = "Answer four questions. We'll build your order.";

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

export const SLOT_LABELS: Record<Slot, string> = {
  canopy: "Canopy",
  understory: "Understory",
  shrub: "Shrub",
  support: "Support",
  early: "Early season",
  late: "Late season",
  offseason: "Off season",
};

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
export const BUILD_ORDER = "Build my order";
export const BUILD_GROUP = (tierLabel: string, trees: number) =>
  `Build my ${tierLabel} order (${trees} trees)`;
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

export const SHIP_BOTH_TIERS =
  "Your potted trees ship now; your bareroot trees ship in your zone's window.";
export const SHIP_POTTED = (days: [number, number]) =>
  `Potted trees ship now, peat and bagged, in ${days[0]} to ${days[1]} business days.`;
export const WAVES_CLOSED = (zone: number) =>
  `Bareroot pre-orders for zone ${zone} are closed right now. They open September 1 for the fall wave and November 1 for spring. Add your email to the lines below and we will say when.`;
export const MIX_REFUSED_BARE_FIRST =
  "Pre-orders check out on their own. Build the potted order first, check out, then come back for the bareroot lines.";
