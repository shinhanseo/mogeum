/** ML Kit starts its optional model download on first inference. Retry only that readiness failure. */
export async function withModelReadiness<T>(action: () => Promise<T>, android: boolean, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await action(); }
    catch (error) {
      const downloading = error instanceof Error && /Waiting for the subject segmentation optional module to be downloaded/i.test(error.message);
      if (!android || !downloading || attempt >= 4) throw error;
      await wait(3000);
    }
  }
}
