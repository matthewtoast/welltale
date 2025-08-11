import { ZodError, z } from "zod";

export function validShape<T>(zodObj: TZodSpec<T>, objToTest: any): T | null {
  const outcome = zodObj.safeParse(objToTest) as any;
  if (outcome["success"]) {
    return outcome["data"] as T;
  }
  return null;
}

export type TZodSpec<T> = {
  description?: string;
  safeParse: (objToTest: any) =>
    | {
        success: boolean;
        data: T;
      }
    | { error: ZodError };
};

export const stringifyZodSchema = (schema: z.ZodTypeAny | any, depth = 0): string => {
  const indent = "  ".repeat(depth);
  if (schema instanceof z.ZodObject) {
    const properties = Object.entries(schema.shape)
      .map(([key, value]) => `${indent} ${key}: ${stringifyZodSchema(value, depth + 1)}`)
      .join("\n");
    return `{\n${properties}\n${indent}}`;
  } else if (schema instanceof z.ZodArray) {
    return `[${stringifyZodSchema(schema.element, depth + 1)}]`;
  } else if (schema instanceof z.ZodString) {
    return "string";
  } else if (schema instanceof z.ZodNumber) {
    return "number";
  } else if (schema instanceof z.ZodBoolean) {
    return "boolean";
  } else {
    return "unknown";
  }
};
