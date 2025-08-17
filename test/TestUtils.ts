import { isDeepStrictEqual } from "util";

export function expect(a: any, b: any) {
  const msg = `${JSON.stringify(a)} === ${JSON.stringify(b)}`;
  if (isDeepStrictEqual(a, b)) {
    console.info("✅", msg);
  } else {
    console.error("❌", msg);
  }
}
