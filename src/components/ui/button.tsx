import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground",
  secondary: "bg-surface-2 text-foreground border border-border",
  danger: "bg-red-600 text-white",
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-md px-5 font-medium disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
