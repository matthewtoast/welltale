import { TViewProps, View } from "./View";

export function Row({
  children,
  gap,
  style,
  expand,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  gap?: number;
} & TViewProps) {
  return (
    <View
      className={`row ${className || ""}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ gap, ...style, flex: expand ? 1 : "none" }}
    >
      {children}
    </View>
  );
}
