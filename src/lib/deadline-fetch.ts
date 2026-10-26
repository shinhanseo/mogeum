/** Keep the deadline signal alive through response body consumption, not just response headers. */
export function createDeadlineFetch(
  base: typeof fetch,
  milliseconds = 20_000,
): typeof fetch {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1)
    throw Error("INVALID_REQUEST_DEADLINE");
  return (input, init) => {
    const caller =
      init?.signal !== undefined
        ? init.signal
        : typeof Request !== "undefined" && input instanceof Request
          ? input.signal
          : undefined;
    if (caller?.aborted)
      return Promise.reject(
        caller.reason ?? new DOMException("Request aborted", "AbortError"),
      );
    const deadline = AbortSignal.timeout(milliseconds);
    return base(input, {
      ...init,
      signal: caller ? AbortSignal.any([caller, deadline]) : deadline,
    });
  };
}
