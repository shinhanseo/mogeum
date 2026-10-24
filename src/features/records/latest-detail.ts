import type { loadRecordDetail } from "./detail";
type Detail = Awaited<ReturnType<typeof loadRecordDetail>>;
export type DetailLoadState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; value: Detail };
/** Treat the record, history and private photo as one result; never publish a superseded read. */
export function createLatestDetailLoader(ports: {
  read: () => Promise<Detail>;
  publish: (state: DetailLoadState) => void;
}) {
  let generation = 0;
  let state: DetailLoadState = { status: "loading" };
  const photoAttempts = new Set<string>();
  const publish = (next: DetailLoadState) => {
    state = next;
    ports.publish(next);
  };
  async function load(resetPhotos = true) {
    if (resetPhotos) photoAttempts.clear();
    const request = ++generation;
    publish({ status: "loading" });
    try {
      const value = await ports.read();
      if (request === generation) publish({ status: "ready", value });
    } catch {
      if (request === generation) publish({ status: "failed" });
    }
  }
  return {
    load: () => load(),
    cancel() {
      generation++;
    },
    async refreshPhoto(failedUri: string) {
      if (
        state.status !== "ready" ||
        !failedUri ||
        state.value.photoUri !== failedUri
      )
        return;
      const record = state.value.record;
      const identity = JSON.stringify([
        record.id,
        record.revision,
        record.record_photos.map((p) => p.storage_path),
      ]);
      if (photoAttempts.has(identity)) return;
      photoAttempts.add(identity);
      await load(false);
    },
  };
}
