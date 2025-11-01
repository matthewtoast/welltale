import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import {
  loadQuickJs,
  SandboxFunction,
  SandboxOptions,
} from "@sebastianwessel/quickjs";
import { parseScript } from "meriyah";
import { TSerial } from "../typings";
import { NestedRecords } from "./engine/StoryTypes";
import { ExprEvalFunc } from "./EvalCasting";
import { cleanSplit, removeTrailing } from "./TextHelpers";

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

function isExpression(source: string) {
  if (!source.trim()) return false;
  try {
    const ast = parseScript(source, {
      module: true,
      next: true,
      webcompat: true,
    });
    if (ast.body.length !== 1) return false;
    return ast.body[0].type === "ExpressionStatement";
  } catch {
    return false;
  }
}

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
    .filter((k) => !valKeys.includes(k))
    // `set` is a special case; don't allow re-definition
    .filter((k) => k !== "set");

  const env = {
    get: (k: string): TSerial => vars[k] ?? null, // TODO: lodash.get
    set: (k: string, v: TSerial) => {
      if (typeof funcs.set === "function") {
        funcs.set(k, v);
      } else {
        vars[k] = v;
      }
      // We must return null here or QuickJS will crash when the following conditions are met:
      // (1) the expression is treated as a singleLine, (2) an array/object is returned
      return null;
    },
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

  const shouldReturn =
    isExpression(bodyRaw) || (isSingleLine && !looksLikeStmt);
  const body = shouldReturn
    ? `return (${removeTrailing(bodyRaw, ";")})`
    : bodyRaw;

  const code = `${imports}\n;export default (async()=>{${prelude};${body}})()`;

  function logError(error: any) {
    if (typeof error === "string") {
      console.error(error);
    } else if (error && typeof error === "object") {
      console.error(error.stack ?? error.message ?? error.name ?? error);
    }
    console.info(`=====\n=====${prelude}\n${body}\n=====`);
  }

  try {
    const res = await runner(async ({ evalCode }) => evalCode(code), {
      env,
      ...options,
      mountFs: { src: mount },
    });

    if (!res.ok) {
      logError(res.error);
      return null;
    }

    return (res.data ?? null) as TSerial;
  } catch (error) {
    logError(error);
    return null;
  }
};
