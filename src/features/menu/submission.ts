import type { MenuDraft } from "./device";
import type { MenuPhoto } from "../../../supabase/functions/_shared/menu-domain";
type Port = {
  read: () => MenuDraft;
  write: (draft: MenuDraft) => Promise<void>;
  save: (draft: MenuDraft, photos: MenuPhoto[]) => Promise<number>;
  active: () => boolean;
};
/** Replay the exact uncertain write before submitting edited input at its acknowledged revision. */
export async function submitMenu(
  photos: MenuPhoto[],
  port: Port,
): Promise<MenuDraft | null> {
  if (!port.active()) return null;
  const pending = port.read().pendingSave;
  if (pending) {
    const revision = await port.save(
      { ...port.read(), revision: pending.revision, items: pending.items },
      pending.photos,
    );
    await port.write({ ...port.read(), revision, pendingSave: undefined });
    if (!port.active()) return null;
  }
  const draft = port.read();
  await port.write({
    ...draft,
    pendingSave: { revision: draft.revision, photos, items: draft.items },
  });
  if (!port.active()) return null;
  const revision = await port.save(draft, photos);
  if (port.read().id === draft.id && port.read().revision === draft.revision)
    await port.write({ ...port.read(), revision, pendingSave: undefined });
  return port.active() ? draft : null;
}
