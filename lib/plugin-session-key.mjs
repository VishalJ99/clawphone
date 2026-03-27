// @ts-check
import crypto from "node:crypto";

function normalizeAgentId(agentId) {
  return typeof agentId === "string" && agentId.trim()
    ? agentId.trim().toLowerCase()
    : "main";
}

function entryUpdatedAt(entry) {
  return typeof entry?.updatedAt === "number" && Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0;
}

function mergeSessionEntries(primary, secondary) {
  if (primary && secondary) {
    const merged = {
      ...secondary,
      ...primary,
      updatedAt: Math.max(entryUpdatedAt(primary), entryUpdatedAt(secondary)),
    };
    if (merged.systemPromptReport && typeof merged.systemPromptReport === "object") {
      merged.systemPromptReport = {
        ...merged.systemPromptReport,
      };
    }
    return merged;
  }
  return primary ?? secondary ?? null;
}

export function canonicalPluginSessionKey(agentId, sessionKey) {
  return `agent:${normalizeAgentId(agentId)}:${sessionKey}`;
}

// Older plugin builds wrote bare session keys like `phone`, which causes the
// gateway list view and transcript view to disagree once OpenClaw canonicalizes
// them to `agent:<id>:phone`. Fold the legacy entry into the canonical key.
export function resolvePluginSessionEntry({ store, agentId, sessionKey }) {
  const canonicalKey = canonicalPluginSessionKey(agentId, sessionKey);
  const canonicalEntry = store[canonicalKey];
  const legacyEntry = store[sessionKey];
  const primary =
    entryUpdatedAt(canonicalEntry) >= entryUpdatedAt(legacyEntry) ? canonicalEntry : legacyEntry;
  const secondary = primary === canonicalEntry ? legacyEntry : canonicalEntry;
  const merged = mergeSessionEntries(primary, secondary) ?? {
    sessionId: crypto.randomUUID(),
    updatedAt: Date.now(),
  };
  if (merged.systemPromptReport && typeof merged.systemPromptReport === "object") {
    merged.systemPromptReport = {
      ...merged.systemPromptReport,
      sessionKey: canonicalKey,
    };
  }
  store[canonicalKey] = merged;
  if (sessionKey !== canonicalKey) {
    delete store[sessionKey];
  }
  return {
    key: canonicalKey,
    entry: merged,
  };
}
