import { createDeadlineFetch } from './deadline-fetch';

/** Bound logout only; do not change OAuth, Storage or function request lifetimes. */
export function createLogoutFetch(base: typeof fetch, backendUrl: string, milliseconds = 20_000): typeof fetch {
  const endpoint = new URL(`${backendUrl.replace(/\/+$/, '')}/auth/v1/logout`);
  const bounded = createDeadlineFetch(base, milliseconds);
  return (input, init) => {
    let target: URL;
    try {
      target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    } catch {
      return base(input, init);
    }
    return target.origin === endpoint.origin && target.pathname === endpoint.pathname
      ? bounded(input, init)
      : base(input, init);
  };
}
