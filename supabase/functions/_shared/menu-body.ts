export class MenuBodyTooLargeError extends Error {
  constructor() {
    super("TOO_LARGE");
  }
}
/** Read incrementally; preserve the existing UTF-16 character limit without buffering an unbounded body. */
export async function readMenuBody(
  request: Pick<Request, "headers" | "body">,
  maxChars = 600000,
): Promise<string> {
  // Valid UTF-8 uses at most three bytes per UTF-16 code unit (four-byte characters use two units).
  const maxBytes = maxChars * 3 + 3; // Allow the leading UTF-8 BOM stripped by TextDecoder.
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    await request.body?.cancel().catch(() => {});
    throw new MenuBodyTooLargeError();
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new MenuBodyTooLargeError();
      }
      text += decoder.decode(chunk.value, { stream: true });
      if (text.length > maxChars) {
        await reader.cancel().catch(() => {});
        throw new MenuBodyTooLargeError();
      }
    }
    text += decoder.decode();
    if (text.length > maxChars) throw new MenuBodyTooLargeError();
    return text;
  } finally {
    reader.releaseLock();
  }
}
