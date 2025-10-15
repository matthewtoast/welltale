import {
  calculateTokenCost,
  createCostTracker,
  makeTokenCostEntry,
  normalizeModelKey,
  registerTokenPricing,
  resetTokenPricing,
} from "../lib/MeteringUtils";
import { expect } from "./TestUtils";

async function testMeteringUtils() {
  resetTokenPricing();
  registerTokenPricing("openai/gpt-5-mini", { input: 2, output: 4 });
  const tracker = createCostTracker();
  const usage = {
    promptTokens: 500,
    completionTokens: 250,
    totalTokens: 750,
  };
  const entry = makeTokenCostEntry("llm", "openai/gpt-5-mini", usage);
  tracker.add(entry);
  const summary = tracker.summary();
  expect(summary.total, calculateTokenCost("openai/gpt-5-mini", usage));
  expect(summary.items.length, 1);
  expect(summary.items[0].units, 750);
  expect(summary.items[0].cost, 2);
  expect(normalizeModelKey("openai/gpt-5-mini:online"), "openai/gpt-5-mini");
  tracker.reset();
  const resetSummary = tracker.summary();
  expect(resetSummary.total, 0);
  expect(resetSummary.items.length, 0);
  console.log("✓ metering.test.ts passed");
}

testMeteringUtils();
