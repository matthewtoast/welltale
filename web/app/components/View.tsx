import React from "react";

export type TViewProps = {
  title?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  expand?: boolean;
  onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export function View({ title, children, style, className, expand, onClick, onMouseEnter, onMouseLeave }: TViewProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        flex: expand ? 1 : "none",
        ...style,
      }}
      title={title}
    >
      {children}
    </div>
  );
}
