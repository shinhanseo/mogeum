function sameSourceFile(source: string, generated: string) {
  if (source === generated) return true;
  try {
    const a = new URL(source), b = new URL(generated);
    return a.protocol === "file:" && b.protocol === "file:"
      && decodeURIComponent(a.pathname) === decodeURIComponent(b.pathname);
  } catch { return false; }
}
/** Own only this invocation's ImageManipulator result, never its selected source or durable copy. */
export async function withGeneratedRecordImage<T>(
  image: { source: string; generated: string; cacheDirectory: string | null },
  persist: () => Promise<T>,
  remove: (uri: string) => Promise<unknown>,
): Promise<T> {
  try {
    return await persist();
  } finally {
    const { source, generated, cacheDirectory } = image;
    if (
      !sameSourceFile(source, generated) &&
      cacheDirectory?.endsWith("/") &&
      generated.startsWith(cacheDirectory) &&
      /^ImageManipulator\/[a-z0-9_-]+\.jpe?g$/i.test(
        generated.slice(cacheDirectory.length),
      )
    ) {
      // A failed cache cleanup must not turn a successfully persisted photo into an error.
      await remove(generated).catch(() => {});
    }
  }
}
