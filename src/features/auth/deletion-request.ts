type Result = { state: "running" | "complete" };
/** Retain every submitted credential until completion: a refreshed session may differ from the server's completion receipt. */
export async function resolveDeletionRequest(
  tokens: readonly string[],
  current: string | undefined,
  ports: {
    send: (token: string) => Promise<Response>;
    persist: (tokens: string[]) => Promise<void>;
  },
): Promise<Result> {
  async function attempt(token: string) {
    const response = await ports.send(token);
    if (response.status === 401) return null;
    if (!response.ok) throw Error("DELETION_RETRY_REQUIRED");
    const result = await response.json();
    if (result.state !== "running" && result.state !== "complete")
      throw Error("INVALID_RESPONSE");
    return result as Result;
  }
  for (const token of [...tokens].reverse()) {
    const result = await attempt(token);
    if (result) return result;
  }
  if (current && !tokens.includes(current)) {
    // Never evict an older credential while its deletion response could still have been lost.
    if (tokens.length >= 16) throw Error("DELETION_RETRY_REQUIRED");
    await ports.persist([...tokens, current]);
    const result = await attempt(current);
    if (result) return result;
  }
  throw Error("LOGIN_REQUIRED");
}
