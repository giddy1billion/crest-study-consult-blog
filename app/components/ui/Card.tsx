import type { ReactNode } from "react";
import { cn } from "~/utils/cn";

export interface CardProps {
  children: ReactNode;
  variant?: "default" | "elevated" | "bordered" | "accent";
  className?: string;
}

const variants = {
  default: "bg-white",
  elevated: "bg-white shadow-md",
  bordered: "bg-white border border-gray-200",
  accent: "bg-white border-l-4 border-teal-500",
};

export function Card({ children, variant = "default", className }: CardProps) {
  return (
    <div className={cn("rounded-lg", variants[variant], className)}>
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn("p-6 pb-0", className)}>{children}</div>;
}

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn("p-6 pt-0 border-t border-gray-100", className)}>
      {children}
    </div>
  );
}
