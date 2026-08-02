/**
 * Routes a verified Discord interaction to an immediate response, plus an
 * optional deferred follow-up. Phase 1 handles `/insights` (digest pull). Phase
 * 2 (GOL-470) adds the content-approval loop: Approve/Revise/Reject buttons on
 * #cmo-approvals cards, an allowlist gate (Macy + Josh), and a prefilled Revise
 * modal. Pure/synchronous so it is trivially unit-testable; the server performs
 * the async side effects (Buffer draft, audit mirror, message edit).
 */
import { isApprover, actorId, type ActorCarrier } from "./allowlist.ts";
import {
  buildReviseModal,
  parseAction,
  parseCardContext,
  parseModalId,
  readModalText,
  type Platform,
} from "./approval.ts";
import { parsePeriod } from "./period.ts";
import {
  IDEA_COMMAND_NAME,
  IDEA_MODAL_ID,
  buildIdeaModal,
  parseIdeaModal,
} from "./idea.ts";
import type { Period } from "./types.ts";

/** Discord interaction request types. */
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;

/** Discord interaction response types. */
export const ResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;

/** Ephemeral message flag. */
const EPHEMERAL = 64;

export const INSIGHTS_COMMAND_NAME = "insights";

export interface DiscordInteraction extends ActorCarrier {
  type: number;
  data?: {
    name?: string;
    custom_id?: string;
    options?: Array<{ name: string; value?: unknown }>;
    /** Modal-submit rows. */
    components?: unknown;
  };
  /** Present on MESSAGE_COMPONENT interactions — the card the button is on. */
  message?: unknown;
}

/** Deferred work the server must perform after the synchronous ack. */
export type Followup =
  | { kind: "digest"; period: Period }
  | {
      kind: "idea_submit";
      headline: string;
      body: string;
      links?: string;
      actor: string;
    }
  | {
      kind: "decision";
      decision: "approve" | "reject";
      suggestionId: string;
      actor: string;
      message: unknown;
    }
  | {
      kind: "revise_submit";
      suggestionId: string;
      actor: string;
      targets: Platform[];
      text: string;
      message: unknown;
    };

export interface InteractionResult {
  /** JSON to return synchronously to Discord. */
  response: { type: number; data?: Record<string, unknown> };
  /** When set, the server performs the deferred work described. */
  followup?: Followup;
}

/** Routing context (Phase 2 needs the approver allowlist). */
export interface RouteContext {
  approverIds: Set<string>;
}

function optionValue(interaction: DiscordInteraction, name: string): string | undefined {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  return typeof opt?.value === "string" ? opt.value : undefined;
}

/**
 * Route an interaction whose Ed25519 signature has ALREADY been verified.
 * Returns the immediate response + any deferred follow-up.
 */
export function routeInteraction(
  interaction: DiscordInteraction,
  ctx: RouteContext = { approverIds: new Set() },
): InteractionResult {
  if (interaction.type === InteractionType.PING) {
    return { response: { type: ResponseType.PONG } };
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (interaction.data?.name === INSIGHTS_COMMAND_NAME) {
      const period = parsePeriod(optionValue(interaction, "period"));
      // Defer: the digest pull round-trips Buffer, exceeding the 3s budget.
      return {
        response: { type: ResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE },
        followup: { kind: "digest", period },
      };
    }
    if (interaction.data?.name === IDEA_COMMAND_NAME) {
      // Phase 3 (GOL-471): only the CMO allowlist (Macy + Josh) may file ideas —
      // the modal itself is the input surface, so gate before opening it.
      if (!isApprover(interaction, ctx.approverIds)) return ideaDenied();
      return { response: { type: ResponseType.MODAL, data: buildIdeaModal() } };
    }
    return ephemeral(`Unknown command: /${interaction.data?.name ?? "?"}`);
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    return routeComponent(interaction, ctx);
  }

  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    return routeModalSubmit(interaction, ctx);
  }

  return ephemeral("Unsupported interaction type");
}

function routeComponent(interaction: DiscordInteraction, ctx: RouteContext): InteractionResult {
  const customId = interaction.data?.custom_id ?? "";

  // Phase 1: digest period buttons.
  if (customId.startsWith("insights:")) {
    const period = parsePeriod(customId.slice("insights:".length));
    return {
      response: { type: ResponseType.DEFERRED_UPDATE_MESSAGE },
      followup: { kind: "digest", period },
    };
  }

  // Phase 2: content-approval buttons.
  const action = parseAction(customId);
  if (action) {
    if (!isApprover(interaction, ctx.approverIds)) return denied();
    const actor = actorId(interaction) ?? "unknown";
    const { body, pool, targets } = parseCardContext(interaction.message);

    if (action.decision === "revise") {
      // Prefill the modal with the full suggested post (body + tags) to tweak.
      const prefill = pool.length ? `${body}\n\n${pool.join(" ")}` : body;
      return {
        response: {
          type: ResponseType.MODAL,
          data: buildReviseModal(action.suggestionId, prefill, targets),
        },
      };
    }

    // Approve / Reject: ack with a message update; the server does the work.
    return {
      response: { type: ResponseType.DEFERRED_UPDATE_MESSAGE },
      followup: {
        kind: "decision",
        decision: action.decision,
        suggestionId: action.suggestionId,
        actor,
        message: interaction.message,
      },
    };
  }

  return ephemeral(`Unknown action: ${customId}`);
}

function routeModalSubmit(interaction: DiscordInteraction, ctx: RouteContext): InteractionResult {
  const customId = interaction.data?.custom_id ?? "";

  // Phase 3 (GOL-471): the `/idea` intake modal.
  if (customId === IDEA_MODAL_ID) {
    if (!isApprover(interaction, ctx.approverIds)) return ideaDenied();
    const fields = parseIdeaModal(interaction.data?.components);
    if (!fields) return ephemeral("Nothing to file — a headline and the idea are both required.");
    return {
      // Ephemeral deferred ack: the server files the idea, then edits this
      // reply with the outcome (only the submitter sees it).
      response: {
        type: ResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: EPHEMERAL },
      },
      followup: {
        kind: "idea_submit",
        headline: fields.headline,
        body: fields.body,
        links: fields.links,
        actor: actorId(interaction) ?? "unknown",
      },
    };
  }

  const parsed = parseModalId(customId);
  if (!parsed) return ephemeral("Unknown submission.");
  if (!isApprover(interaction, ctx.approverIds)) return denied();

  const text = readModalText(interaction.data?.components);
  if (!text) return ephemeral("Nothing to draft — the revised text was empty.");

  return {
    response: { type: ResponseType.DEFERRED_UPDATE_MESSAGE },
    followup: {
      kind: "revise_submit",
      suggestionId: parsed.suggestionId,
      actor: actorId(interaction) ?? "unknown",
      targets: parsed.targets,
      text,
      message: interaction.message,
    },
  };
}

function ephemeral(message: string): InteractionResult {
  return {
    response: {
      type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: message, flags: EPHEMERAL },
    },
  };
}

function denied(): InteractionResult {
  return ephemeral("🚫 Only Macy and Josh can act on content suggestions.");
}

function ideaDenied(): InteractionResult {
  return ephemeral("🚫 Only Macy and Josh can file content ideas via /idea.");
}
