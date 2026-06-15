import type { ReactNode } from "react";
import { cn } from "~/utils/cn";

export interface ContainerProps {
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  as?: "div" | "section" | "article" | "main";
}

const sizes = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

export function Container({
  children,
  size = "lg",
  className,
  as: Component = "div",
}: ContainerProps) {
  return (
    <Component
      className={cn("mx-auto px-4 sm:px-6 lg:px-8", sizes[size], className)}
    >
      {children}
    </Component>
  );
}
