import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import {
  loadQuickJs,
  SandboxFunction,
  SandboxOptions,
} from "@sebastianwessel/quickjs";
import { TSerial } from "../typings";
import { EvalResult } from "./EvalMethods";
import { ExprEvalFunc } from "./EvalUtils";

const isIdent = (s: string) => /^[A-Za-z_$][\w$]*$/.test(s);

// E.g.
export type RunnerFunc = <T>(
  sandboxedFunction: SandboxFunction<T>,
  sandboxOptions?: SandboxOptions
) => Promise<T>;

export async function createRunner() {
  const { runSandboxed } = await loadQuickJs(variant);
  return runSandboxed;
}

export const evaluateScript = async (
  expr: string,
  vars: Record<string, TSerial>,
  funcs: Record<string, ExprEvalFunc> = {},
  runner: RunnerFunc
): Promise<EvalResult> => {
  const valKeys = Object.keys(vars).filter(isIdent);
  const funcKeys = Object.keys(funcs).filter(isIdent);

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

  const code = `;(()=>{${prelude};return(()=>{${expr}})()})()`;

  const res = await runner(async ({ evalCode }) => evalCode(code), {
    env,
    allowFs: false,
    allowFetch: false,
    executionTimeout: 1000,
  });

  if (!res.ok) throw new Error(String(res.error));
  return (res.data ?? null) as EvalResult;
};
