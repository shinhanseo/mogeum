import type { SupabaseClient } from "@supabase/supabase-js";
/** Bounded Storage wait; caller must scope paths to the intended owner before signing. */
export async function signPhotoBatch(client: SupabaseClient, input: string[]) {
  const paths = [...new Set(input)];
  if (paths.length > 200) throw new Error("PHOTO_BATCH_TOO_LARGE");
  if (!paths.length) return new Map<string, string>();
  // Storage batch signing has no per-request abort option in this SDK. Bound the UI wait and ignore late results.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let response: Awaited<
    ReturnType<ReturnType<typeof client.storage.from>["createSignedUrls"]>
  >;
  try {
    response = await Promise.race([
      client.storage.from("record-photos").createSignedUrls(paths, 300),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("PHOTO_LINK_TIMEOUT")),
          10000,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  const { data: signed, error: signingError } = response;
  if (signingError) throw signingError;
  const byPath = new Map<string, string>();
  for (const row of signed ?? []) {
    if (
      !row.error &&
      typeof row.path === "string" &&
      paths.includes(row.path) &&
      typeof row.signedUrl === "string" &&
      row.signedUrl
    )
      byPath.set(row.path, row.signedUrl);
  }
  return byPath;
}
