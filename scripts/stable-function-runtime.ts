/** A file-watch reload may briefly serve the new build before tearing its worker down.
 * Probe only a non-mutating unauthenticated request; never retry destructive tests. */
export async function waitForStableFunction(
  ports: {
    probe: () => Promise<{ status: number; build: string | null }>;
    now: () => number;
    pause: () => Promise<void>;
  },
  build: string,
  minimumMs = 2000,
  attempts = 60,
) {
  let since: number | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await ports.probe();
      if (response.status === 401 && response.build === build) {
        since ??= ports.now();
        if (ports.now() - since >= minimumMs) return;
      } else since = null;
    } catch {
      since = null;
    }
    await ports.pause();
  }
  throw Error("Local runtime did not stabilize on deployment artifact");
}
