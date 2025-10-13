import { normalizeModels } from "../lib/StoryConstants";
import { DEFAULT_LLM_SLUGS, LLM_SLUGS } from "../lib/StoryTypes";
import { expect } from "./TestUtils";

async function test() {
  // Test with no attms (should return defaultModels)
  expect(
    normalizeModels({ models: [] }, undefined),
    DEFAULT_LLM_SLUGS
  );
  
  // Test with empty attms string
  expect(
    normalizeModels({ models: [] }, ""),
    DEFAULT_LLM_SLUGS
  );

  // Test with single model name
  expect(
    normalizeModels({ models: [] }, "openai/gpt-5"),
    ["openai/gpt-5", ...DEFAULT_LLM_SLUGS]
  );

  // Test with multiple model names
  expect(
    normalizeModels({ models: [] }, "openai/gpt-5,anthropic/claude-3.5-sonnet"),
    ["anthropic/claude-3.5-sonnet", "openai/gpt-5", ...DEFAULT_LLM_SLUGS]
  );

  // Test with model tags (all mini models are already in DEFAULT_LLM_SLUGS)
  expect(
    normalizeModels({ models: [] }, "mini"),
    ["openai/gpt-4.1-nano", "openai/gpt-4.1-mini", "openai/gpt-5-nano", "openai/gpt-5-mini"]
  );

  // Test with uncensored tag
  expect(
    normalizeModels({ models: [] }, "uncensored"),
    [
      "meta-llama/llama-3.2-3b-instruct:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
      ...DEFAULT_LLM_SLUGS
    ]
  );

  // Test with options.models
  expect(
    normalizeModels({ models: ["deepseek/deepseek-r1"] }, undefined),
    ["deepseek/deepseek-r1", ...DEFAULT_LLM_SLUGS]
  );

  expect(
    normalizeModels({ models: ["deepseek/deepseek-r1"] }, ""),
    ["deepseek/deepseek-r1", ...DEFAULT_LLM_SLUGS]
  );

  // Test with both attms and options.models
  expect(
    normalizeModels({ models: ["deepseek/deepseek-r1"] }, "openai/gpt-5"),
    ["deepseek/deepseek-r1", "openai/gpt-5", ...DEFAULT_LLM_SLUGS]
  );

  // Test with custom defaultModels
  const customDefaults: typeof DEFAULT_LLM_SLUGS = ["anthropic/claude-3.5-sonnet"];
  expect(
    normalizeModels({ models: [] }, undefined, customDefaults),
    customDefaults
  );

  expect(
    normalizeModels({ models: [] }, "openai/gpt-5", customDefaults),
    ["openai/gpt-5", ...customDefaults]
  );

  // Test with invalid model name (should be ignored)
  expect(
    normalizeModels({ models: [] }, "invalid/model"),
    DEFAULT_LLM_SLUGS
  );

  // Test with mix of valid and invalid models
  expect(
    normalizeModels({ models: [] }, "openai/gpt-5,invalid/model,mini"),
    ["openai/gpt-4.1-nano", "openai/gpt-4.1-mini", "openai/gpt-5-nano", "openai/gpt-5-mini", "openai/gpt-5"]
  );

  // Test deduplication
  expect(
    normalizeModels({ models: ["openai/gpt-5-mini"] }, "openai/gpt-5-mini"),
    ["openai/gpt-5-mini", "openai/gpt-5-nano", "openai/gpt-4.1-mini", "openai/gpt-4.1-nano"]
  );

  // Test order preservation (most recent first)
  expect(
    normalizeModels({ models: [] }, "openai/gpt-4o,openai/gpt-5"),
    ["openai/gpt-5", "openai/gpt-4o", ...DEFAULT_LLM_SLUGS]
  );
}

test();