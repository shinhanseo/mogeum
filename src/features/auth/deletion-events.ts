export type DeletionEvent = { owner: string; active: boolean };
/** A completion from the previous login must never dismiss another account's deletion gate. */
export function deletionOwnerAfterEvent(
  current: string | null,
  activeOwner: string | null,
  event: DeletionEvent,
) {
  if (event.active)
    return activeOwner && activeOwner !== event.owner ? current : event.owner;
  return current === event.owner ? null : current;
}
