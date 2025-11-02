import { castToBoolean, castToNumber, castToString } from "../EvalCasting";
import { isBlank } from "../TextHelpers";
import { MethodDef } from "./MethodHelpers";

export const unifiedHelpers: Record<string, MethodDef> = {
  blank: {
    doc: "Returns true/false if the given value is blank: empty string, empty array, empty object, zero, null, or undefined",
    ex: "wsl.blank('') //=> true",
    fn: (v: any) => {
      return isBlank(v);
    },
  },
  toNumber: {
    doc: "Converts the given value to a number",
    ex: "wsl.toNumber('42') //=> 42",
    fn: (v: any) => {
      return castToNumber(v);
    },
  },
  toString: {
    doc: "Converts the given value to a string",
    ex: "wsl.toString(42) //=> '42'",
    fn: (v: any) => {
      return castToString(v);
    },
  },
  toBoolean: {
    doc: "Converts the given value to a boolean",
    ex: "wsl.toBoolean('true') //=> true",
    fn: (v: any) => {
      return castToBoolean(v);
    },
  },
};
