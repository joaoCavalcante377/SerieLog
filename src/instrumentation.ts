export async function register() {
  // Fail fast with a readable message when required env vars are missing/invalid.
  await import("./env");
}
