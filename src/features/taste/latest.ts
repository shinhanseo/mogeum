import type { TasteContext } from "./repository";

export type TasteLoadState =
  | { status: "loading" }
  | { status: "ready"; context: TasteContext; photos: Record<string, string> }
  | { status: "failed" };

/** Publish context and its photo map together; cancelled or superseded reads cannot resurrect old evidence. */
export function createLatestTasteLoader(ports: {
  context: () => Promise<TasteContext>;
  photos: (context: TasteContext) => Promise<Record<string, string>>;
  publish: (state: TasteLoadState) => void;
}) {
  let generation = 0;
  return {
    cancel() {
      generation++;
    },
    async load() {
      const version = ++generation;
      ports.publish({ status: "loading" });
      try {
        const context = await ports.context();
        if (version !== generation) return;
        // Missing signed photos can use the existing placeholder; failure to verify the records cannot.
        const photos = await ports.photos(context).catch(() => ({}));
        if (version !== generation) return;
        const verified = await ports.context();
        if (version !== generation) return;
        if (
          !context.snapshot.hash ||
          verified.snapshot.hash !== context.snapshot.hash
        )
          throw new Error("TASTE_CONTEXT_CHANGED");
        ports.publish({ status: "ready", context: verified, photos });
      } catch {
        if (version === generation) ports.publish({ status: "failed" });
      }
    },
  };
}
