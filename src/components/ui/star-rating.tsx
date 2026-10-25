"use client";

import { Star } from "lucide-react";
import { applyRatingKey, nextRatingOnStarClick } from "@/lib/domain/rating";
import { ratingText } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  /** Omit (or pass readOnly) for a display-only rating. */
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  /** When true the rating can be cleared (Home key / "Limpar nota" button). */
  clearable?: boolean;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

const STARS = [1, 2, 3, 4, 5] as const;

/** How much of star `n` is filled for a rating: 0, 0.5 or 1. */
const fillOf = (value: number | null, n: number) =>
  Math.max(0, Math.min(1, (value ?? 0) - (n - 1)));

function SingleStar({ fill, className }: { fill: number; className: string }) {
  return (
    <span className="relative inline-block" aria-hidden>
      <Star className={cn(className, "text-border")} />
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${fill * 100}%` }}
      >
        <Star className={cn(className, "text-star fill-current")} />
      </span>
    </span>
  );
}

export function StarRating({
  value,
  onChange,
  readOnly,
  clearable = true,
  label = messages.logs.rating,
  size = "md",
  disabled,
}: StarRatingProps) {
  const iconClass = size === "sm" ? "h-4 w-4" : "h-7 w-7";

  if (readOnly || !onChange) {
    return (
      <span role="img" aria-label={ratingText(value)} className="inline-flex items-center">
        {STARS.map((n) => (
          <SingleStar key={n} fill={fillOf(value, n)} className={iconClass} />
        ))}
      </span>
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const next = applyRatingKey(value, e.key, clearable);
    if (next === undefined) return;
    e.preventDefault();
    onChange?.(next);
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={ratingText(value)}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className="inline-flex items-center rounded"
      >
        {STARS.map((n) => (
          // Mouse/touch only: keyboard and screen readers use the slider itself.
          <span
            key={n}
            data-star={n}
            onClick={() => !disabled && onChange(nextRatingOnStarClick(value, n))}
            className="inline-flex h-11 w-10 cursor-pointer items-center justify-center"
          >
            <SingleStar fill={fillOf(value, n)} className={iconClass} />
          </span>
        ))}
      </div>
      {clearable && value ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="text-muted hover:text-foreground min-h-11 text-sm underline"
        >
          {messages.logs.clearRating}
        </button>
      ) : null}
    </div>
  );
}
