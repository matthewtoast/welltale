import React from "react";
import { View } from "./View";

export type TColProps = {
  gap?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  expand?: boolean;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
};

export function Col({ children, gap, style, expand, className, onClick }: TColProps) {
  return (
    <View className={`col ${className || ""}`} onClick={onClick} style={{ gap, ...style, flex: expand ? 1 : "none" }}>
      {children}
    </View>
  );
}
