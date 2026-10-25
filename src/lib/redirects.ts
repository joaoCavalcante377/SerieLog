/** Only same-site relative paths are accepted as post-login destinations (prevents open redirects). */
export function safeCallbackUrl(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

export function buildLoginRedirect(path: string): string {
  return `/entrar?callbackUrl=${encodeURIComponent(path).replace(/%2F/g, "/")}`;
}
