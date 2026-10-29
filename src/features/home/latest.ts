import type { TasteContext } from "../taste/repository";
import type { DiscoveryResult } from "../discovery/contract";
export type HomeData = {
  context: TasteContext;
  photos: Record<string, string>;
  discovery: DiscoveryResult | null;
  recommendationState: "loading" | "ready" | "unavailable";
};
export type HomeLoadState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; data: HomeData };
/** Publish verified records independently of slower optional photos/recommendations. */
export function createHomeLoader(ports: {
  context: () => Promise<TasteContext>;
  photos: (context: TasteContext) => Promise<Record<string, string>>;
  discovery: () => Promise<DiscoveryResult>;
  publish: (state: HomeLoadState) => void;
}) {
  let generation = 0;
  return {
    cancel() {
      generation++;
    },
    async load() {
      const version = ++generation;
      const active = () => version === generation;
      ports.publish({ status: "loading" });
      try {
        const context = await ports.context();
        if (!active()) return;
        let data: HomeData = {
          context,
          photos: {},
          discovery: null,
          recommendationState: "loading",
        };
        ports.publish({ status: "ready", data });
        await Promise.all([
          (async () => {
            const photos = await ports.photos(context).catch(() => ({}));
            if (!active()) return;
            data = { ...data, photos };
            ports.publish({ status: "ready", data });
          })(),
          (async () => {
            const discovery = await ports.discovery().catch(() => null);
            if (!active()) return;
            const latest = await ports.context();
            if (!active()) return;
            if (latest.snapshot.hash !== context.snapshot.hash) {
              generation++;
              ports.publish({ status: "failed" });
              return;
            }
            const matches = discovery?.tasteHash === latest.snapshot.hash;
            data = {
              ...data,
              context: latest,
              discovery: matches ? discovery : null,
              recommendationState: matches ? "ready" : "unavailable",
            };
            ports.publish({ status: "ready", data });
          })(),
        ]);
      } catch {
        if (active()) {
          generation++;
          ports.publish({ status: "failed" });
        }
      }
    },
  };
}
