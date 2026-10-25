export type CaptureProvider = "apple" | "kakao";
export type PendingProvider = {
  version: 1;
  owner: string;
  provider: CaptureProvider;
  refreshToken: string;
};
const validOwner = (value: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function parsePendingProvider(
  raw: string,
  owner: string,
  provider: CaptureProvider,
): PendingProvider {
  if (raw.length > 100000) throw Error("INVALID_PROVIDER_PENDING");
  const value = JSON.parse(raw);
  if (
    !["apple", "kakao"].includes(provider) ||
    !validOwner(owner) ||
    value?.version !== 1 ||
    value.owner !== owner ||
    value.provider !== provider ||
    typeof value.refreshToken !== "string" ||
    !value.refreshToken.length ||
    value.refreshToken.length > 20000 ||
    /[\r\n]/.test(value.refreshToken)
  )
    throw Error("INVALID_PROVIDER_PENDING");
  return value;
}
export function createProviderCaptureQueue(ports: {
  read: (owner: string, provider: CaptureProvider) => Promise<string | null>;
  write: (value: PendingProvider) => Promise<void>;
  remove: (owner: string, provider: CaptureProvider) => Promise<void>;
  active: (owner: string) => Promise<boolean>;
  send: (value: PendingProvider) => Promise<void>;
}) {
  const pending = new Map<string, Promise<unknown>>(),
    sent = new Map<string, string>();
  function run<T>(
    owner: string,
    provider: CaptureProvider,
    work: () => Promise<T>,
  ) {
    const key = `${owner}:${provider}`;
    const next = (pending.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(work);
    pending.set(key, next);
    void next
      .finally(() => {
        if (pending.get(key) === next) pending.delete(key);
      })
      .catch(() => {});
    return next;
  }
  async function flush(owner: string, provider: CaptureProvider) {
    const raw = await ports.read(owner, provider);
    if (raw === null || !(await ports.active(owner))) return;
    const value = parsePendingProvider(raw, owner, provider);
    await ports.send(value);
    // An in-flight response must not erase a new receipt written outside this queue.
    if ((await ports.read(owner, provider)) === raw) {
      await ports.remove(owner, provider);
      sent.set(`${owner}:${provider}`, value.refreshToken);
    }
  }
  return {
    stage(value: PendingProvider) {
      const captured = parsePendingProvider(
        JSON.stringify(value),
        value.owner,
        value.provider,
      );
      return run(value.owner, value.provider, async () => {
        if (
          sent.get(`${value.owner}:${value.provider}`) === captured.refreshToken
        )
          return;
        const raw = await ports.read(value.owner, value.provider);
        if (raw !== null)
          parsePendingProvider(raw, value.owner, value.provider);
        await ports.write(captured);
      });
    },
    resume(owner: string) {
      return Promise.all(
        (["apple", "kakao"] as const).map((provider) =>
          run(owner, provider, () => flush(owner, provider)),
        ),
      );
    },
    clear(owner: string) {
      return Promise.all(
        (["apple", "kakao"] as const).map((provider) =>
          run(owner, provider, async () => {
            await ports.remove(owner, provider);
            sent.delete(`${owner}:${provider}`);
          }),
        ),
      );
    },
  };
}
