import Image from "next/image";
import { messages } from "@/lib/messages/pt-BR";
import { tmdbImageUrl, type PosterSize } from "@/lib/tmdb/images";
import { cn } from "@/lib/utils";

interface PosterProps {
  path: string | null;
  name: string;
  size?: PosterSize;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/** 2:3 poster with a reserved aspect ratio (no layout shift) and a styled placeholder. */
export function Poster({
  path,
  name,
  size = "w342",
  sizes = "(min-width: 1024px) 180px, (min-width: 640px) 25vw, 40vw",
  priority,
  className,
}: PosterProps) {
  const src = tmdbImageUrl(path, size);
  return (
    <div
      className={cn(
        "bg-surface-2 border-border relative aspect-[2/3] w-full overflow-hidden rounded-md border",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={messages.series.posterAlt(name)}
          fill
          sizes={sizes}
          priority={priority}
          // TMDB serves ready-made sizes (w185…w780), so skip our own image optimizer hop.
          unoptimized
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={messages.series.posterAlt(name)}
          className="text-muted flex h-full items-center justify-center p-3 text-center text-sm"
        >
          {messages.common.noPoster}
        </div>
      )}
    </div>
  );
}
