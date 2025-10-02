export const colors = {
  WHITE: "#faf6efff",
  BLACK: "#0b0a13ff",
  BLACK_WELL: "#110f1dff",
  GRAY_LIGHT: "#777777ff",
  GRAY_DARK: "#272d38",
  GRAY_NIGHT: "#0f141eff",
} as const;

export type ColorName = keyof typeof colors;
export type ColorValue = (typeof colors)[ColorName];
