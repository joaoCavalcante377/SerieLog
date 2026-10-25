import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "./action-result";

/** Maps a failed ActionResult's field errors onto the form. Returns true if any field was set. */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  result: ActionResult<unknown>,
): boolean {
  if (result.ok || !result.error.fieldErrors) return false;
  const entries = Object.entries(result.error.fieldErrors);
  for (const [field, message] of entries) {
    setError(field as Path<T>, { type: "server", message });
  }
  return entries.length > 0;
}
