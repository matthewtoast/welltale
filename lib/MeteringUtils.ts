import { clamp } from "lodash";

type TokenPricing = {
  input: number;
  output: number;
};

export type CostKind =
  | "llm"
  | "speech"
  | "music"
  | "sound"
  | "voice"
  | "image"
  | "http"
  | "other";

export type CostEntry = {
  kind: CostKind;
  model: string;
  units: number;
  cost: number;
};

export type CostSummary = {
  total: number;
  items: CostEntry[];
};

export type CostTracker = {
  add: (entry: CostEntry) => void;
  summary: () => CostSummary;
  reset: () => void;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const tokenPricing: Record<string, TokenPricing> = {};

function sanitizeNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function cloneEntries(entries: CostEntry[]) {
  return entries.map((entry) => ({ ...entry }));
}

function ensureTotalTokens(usage: TokenUsage) {
  const prompt = sanitizeNumber(usage.promptTokens);
  const completion = sanitizeNumber(usage.completionTokens);
  const total = sanitizeNumber(usage.totalTokens);
  if (total > 0) {
    return {
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: total,
    };
  }
  const sum = prompt + completion;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: sum,
  };
}

function toPennies(value: number) {
  return sanitizeNumber(value);
}

export function resetTokenPricing() {
  Object.keys(tokenPricing).forEach((key) => {
    delete tokenPricing[key];
  });
}

export function registerTokenPricing(model: string, pricing: TokenPricing) {
  const key = normalizeModelKey(model);
  tokenPricing[key] = pricing;
}

export function normalizeModelKey(model: string) {
  if (model.includes(":")) {
    return model.split(":")[0];
  }
  return model;
}

export function calculateTokenCost(model: string, usage: TokenUsage) {
  const ensured = ensureTotalTokens(usage);
  const key = normalizeModelKey(model);
  const pricing = tokenPricing[key];
  if (!pricing) {
    return 0;
  }
  const input = clamp(pricing.input, 0, Number.MAX_SAFE_INTEGER);
  const output = clamp(pricing.output, 0, Number.MAX_SAFE_INTEGER);
  const prompt = ensured.promptTokens;
  const completion = ensured.completionTokens;
  const promptCost = (prompt * input) / 1000;
  const completionCost = (completion * output) / 1000;
  return toPennies(promptCost + completionCost);
}

export function makeTokenCostEntry(
  kind: CostKind,
  model: string,
  usage: TokenUsage
): CostEntry {
  const ensured = ensureTotalTokens(usage);
  const normalizedModel = normalizeModelKey(model);
  const cost = calculateTokenCost(normalizedModel, ensured);
  return {
    kind,
    model: normalizedModel,
    units: ensured.totalTokens,
    cost,
  };
}

export function createCostTracker(): CostTracker {
  let entries: CostEntry[] = [];
  return {
    add(entry: CostEntry) {
      const model = entry.model || "";
      const units = sanitizeNumber(entry.units);
      const cost = sanitizeNumber(entry.cost);
      entries.push({ kind: entry.kind, model, units, cost });
    },
    summary() {
      const total = entries.reduce((sum, entry) => sum + entry.cost, 0);
      return {
        total,
        items: cloneEntries(entries),
      };
    },
    reset() {
      entries = [];
    },
  };
}
