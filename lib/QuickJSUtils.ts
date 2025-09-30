import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import {
  loadQuickJs,
  SandboxFunction,
  SandboxOptions,
} from "@sebastianwessel/quickjs";
import { TSerial } from "../typings";
import { ExprEvalFunc } from "./EvalCasting";
import { NestedRecords } from "./StoryTypes";
import { cleanSplit } from "./TextHelpers";

const isIdent = (s: string) => /^[A-Za-z_$][\w$]*$/.test(s);

export type RunnerFunc = <T>(
  sandboxedFunction: SandboxFunction<T>,
  sandboxOptions?: SandboxOptions
) => Promise<T>;

export async function createRunner() {
  const { runSandboxed } = await loadQuickJs(variant);
  return runSandboxed;
}

const stmtLike =
  /^(return|export|import|function|class|if|for|while|do|switch|try|catch|finally|var|let|const)\b/;

export type EvalOptions = {
  allowFs: boolean;
  allowFetch: boolean;
  executionTimeout: number;
  memoryLimit: number;
  maxIntervalCount: number;
  maxTimeoutCount: number;
  maxStackSize: number;
};

export const evaluateScript = async (
  expr: string,
  vars: Record<string, TSerial>,
  funcs: Record<string, ExprEvalFunc> = {},
  runner: RunnerFunc,
  mount: NestedRecords = {},
  options: EvalOptions = {
    allowFs: false,
    allowFetch: false,
    executionTimeout: 5_000,
    memoryLimit: Math.pow(1024, 2) * 10, // MB
    maxIntervalCount: 0,
    maxTimeoutCount: 0,
    maxStackSize: 10_000,
  }
): Promise<TSerial> => {
  const valKeys = Object.keys(vars).filter(isIdent);
  const funcKeys = Object.keys(funcs)
    .filter(isIdent)
    .filter((k) => !valKeys.includes(k));

  const env = {
    get: (k: string): TSerial => vars[k] ?? null,
    set: (k: string, v: TSerial) => (vars[k] = v),
    __v: Object.fromEntries(valKeys.map((k) => [k, vars[k]])),
    __f: Object.fromEntries(funcKeys.map((k) => [k, funcs[k]])),
  };

  const prelude =
    `const {get,set}=env;` +
    (valKeys.length ? `const {${valKeys.join(",")}}=env.__v;` : "") +
    (funcKeys.length ? `const {${funcKeys.join(",")}}=env.__f;` : "");

  const lines = cleanSplit(expr, "\n");
  const imports = lines.filter((l) => l.startsWith("import ")).join("\n");
  const rest = lines.filter((l) => !l.startsWith("import "));
  const bodyRaw = rest.join("\n");

  const isSingleLine = rest.length === 1;
  const looksLikeStmt =
    stmtLike.test(bodyRaw) ||
    /;/.test(bodyRaw) ||
    /^\w+\s*=/.test(bodyRaw) ||
    /^\(.*\)\s*=>/.test(bodyRaw);

  const body = isSingleLine && !looksLikeStmt ? `return (${bodyRaw})` : bodyRaw;

  const code = `${imports}\n;export default (async()=>{${prelude};${body}})()`;

  try {
    const res = await runner(async ({ evalCode }) => evalCode(code), {
      env,
      ...options,
      mountFs: { src: mount },
    });

    if (!res.ok) {
      console.error(res.error);
      return null;
    }

    return (res.data ?? null) as TSerial;
  } catch (error) {
    console.error(error);
    return null;
  }
};
