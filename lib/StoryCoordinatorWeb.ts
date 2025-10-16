import { assignInput } from "./StoryConstants";
import { runWithPrefetch } from "./StoryRunnerCorePrefetch";
import {
  OP,
  StoryAdvanceResult,
  StoryOptions,
  StorySession,
} from "./StoryTypes";
import { apiSafeRequest } from "./WebAPI";

export async function apiAdvanceStory(
  baseUrl: string,
  session: StorySession,
  options: StoryOptions,
  token: string
): Promise<StoryAdvanceResult | null> {
  const payload = JSON.stringify({ session, options });
  const res = await apiSafeRequest(
    `${baseUrl}/api/stories/advance`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    },
    token
  );
  if (!res) return null;
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  return data as StoryAdvanceResult;
}

export class StoryCoordinatorWeb {
  constructor(
    public session: StorySession,
    public options: StoryOptions,
    public config: {
      apiToken: string;
      apiBaseUrl: string;
    }
  ) {}

  async run(
    input: string | null,
    render: (ops: OP[]) => Promise<void>
  ): Promise<StoryAdvanceResult | null> {
    return await runWithPrefetch(
      input,
      async (input) => {
        return this.advance(input);
      },
      render
    );
  }

  async advance(input: string | null): Promise<StoryAdvanceResult | null> {
    assignInput(this.session, input);
    const result = await apiAdvanceStory(
      this.config.apiBaseUrl,
      this.session,
      this.options,
      this.config.apiToken
    );
    if (!result) {
      return null;
    }
    Object.assign(this.session, result.session);
    return result;
  }
}
