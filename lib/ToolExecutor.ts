import { OpenAI } from "openai";
import { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources";
import { safeJsonParse } from "./JSONHelpers";

export interface ToolFunction {
  function: (...args: any[]) => Promise<any>;
  schema: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolRegistry {
  [toolName: string]: ToolFunction;
}

export interface ToolExecutionOptions {
  model?: string;
  temperature?: number;
  maxIterations?: number;
  systemPrompt?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  finalResponse: string;
  toolCallsExecuted: Array<{
    toolName: string;
    arguments: any;
    result: any;
    error?: string;
  }>;
  conversationHistory: ChatCompletionMessageParam[];
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that can use tools to accomplish tasks. 

When given a task:
1. Analyze what needs to be done
2. Plan the sequence of tool calls needed
3. Execute the tools in the correct order
4. Provide a clear summary of what was accomplished

You have access to the following capabilities through tool calls. Use them when appropriate to complete the user's request.

Important guidelines:
- Always use the tools available rather than just describing what should be done
- If you need information from one tool call to use in another, make the calls sequentially
- Provide clear explanations of what you're doing and why
- If a tool call fails, try to understand why and potentially retry with different parameters`;

export async function executeWithTools(
  openai: OpenAI,
  userPrompt: string,
  tools: ToolRegistry,
  options: ToolExecutionOptions = {},
): Promise<ToolExecutionResult> {
  const { model = "gpt-4o", temperature = 0.1, maxIterations = 10, systemPrompt = DEFAULT_SYSTEM_PROMPT } = options;

  const toolCallsExecuted: ToolExecutionResult["toolCallsExecuted"] = [];
  const conversationHistory: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // Convert tool registry to OpenAI tools format
  const openaiTools: ChatCompletionTool[] = Object.entries(tools).map(([name, tool]) => ({
    type: "function",
    function: tool.schema,
  }));

  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: conversationHistory,
        tools: openaiTools,
        tool_choice: "auto",
        temperature,
      });

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error("No response from OpenAI");
      }

      conversationHistory.push(message);

      // If no tool calls, we're done
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return {
          success: true,
          finalResponse: message.content || "Task completed",
          toolCallsExecuted,
          conversationHistory,
        };
      }

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const tool = tools[toolName];

        if (!tool) {
          const errorMsg = `Unknown tool: ${toolName}`;
          conversationHistory.push({
            role: "tool",
            content: errorMsg,
            tool_call_id: toolCall.id,
          });
          toolCallsExecuted.push({
            toolName,
            arguments: toolCall.function.arguments,
            result: null,
            error: errorMsg,
          });
          continue;
        }

        try {
          // Parse arguments
          const args = safeJsonParse(toolCall.function.arguments) || {};

          // Execute the tool function
          const result = await tool.function(...Object.values(args));

          // Add tool response to conversation
          conversationHistory.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });

          toolCallsExecuted.push({
            toolName,
            arguments: args,
            result,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Tool execution failed";

          conversationHistory.push({
            role: "tool",
            content: `Error: ${errorMsg}`,
            tool_call_id: toolCall.id,
          });

          toolCallsExecuted.push({
            toolName,
            arguments: safeJsonParse(toolCall.function.arguments) || {},
            result: null,
            error: errorMsg,
          });
        }
      }
    } catch (error) {
      return {
        success: false,
        finalResponse: `Execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        toolCallsExecuted,
        conversationHistory,
      };
    }
  }

  return {
    success: false,
    finalResponse: `Max iterations (${maxIterations}) reached without completion`,
    toolCallsExecuted,
    conversationHistory,
  };
}

// Helper function to create tool schemas more easily
export function createTool<T extends (...args: any[]) => Promise<any>>(
  name: string,
  description: string,
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  },
  func: T,
): ToolFunction {
  return {
    function: func,
    schema: {
      name,
      description,
      parameters,
    },
  };
}

// Example usage helper
export function createSimpleTextTool(
  name: string,
  description: string,
  func: (input: string) => Promise<string>,
): ToolFunction {
  return createTool(
    name,
    description,
    {
      type: "object",
      properties: {
        input: { type: "string", description: "The input text" },
      },
      required: ["input"],
    },
    func,
  );
}
