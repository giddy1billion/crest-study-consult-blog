import type { ReactNode } from "react";
import { cn } from "~/utils/cn";

export interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  background?: "white" | "gray" | "dark";
}

const backgrounds = {
  white: "bg-white",
  gray: "bg-gray-50",
  dark: "bg-gray-900 text-white",
};

export function Section({
  children,
  className,
  id,
  background = "white",
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn("py-12 lg:py-16", backgrounds[background], className)}
    >
      {children}
    </section>
  );
}
