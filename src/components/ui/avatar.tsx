import { messages } from "@/lib/messages/pt-BR";

/**
 * Avatar from a user-supplied https URL (any host, so a plain <img> instead of next/image),
 * falling back to initials. `referrerPolicy` keeps our URLs out of third-party logs.
 */
export function Avatar({
  name,
  src,
  size = 96,
}: {
  name: string;
  src: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={messages.profile.avatarAlt(name)}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="bg-surface-2 shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      role="img"
      aria-label={messages.profile.avatarAlt(name)}
      className="bg-surface-2 text-muted flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {initials}
    </div>
  );
}
