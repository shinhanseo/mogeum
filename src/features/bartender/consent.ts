export const BARTENDER_CONSENT_VERSION = "gemini-chat-v1";
export const bartenderConsentKey = (owner: string) =>
  `mogeum:bartender-consent:v1:${owner}`;
/** No chat request or durable request payload is written before explicit third-party consent. */
export function createBartenderConsent(ports: {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  active: () => boolean;
  ask: (agree: () => void) => void;
  error: () => void;
}) {
  let granted = false,
    opening = false;
  return {
    async run(work: () => void) {
      if (!ports.active() || opening) return;
      if (granted) {
        work();
        return;
      }
      opening = true;
      try {
        const accepted = await ports.read();
        if (!ports.active()) return;
        if (accepted === BARTENDER_CONSENT_VERSION) {
          granted = true;
          work();
          return;
        }
        ports.ask(() => {
          void (async () => {
            if (!ports.active()) return;
            try {
              await ports.write(BARTENDER_CONSENT_VERSION);
              if (!ports.active()) return;
              granted = true;
              work();
            } catch {
              if (ports.active()) ports.error();
            }
          })();
        });
      } catch {
        if (ports.active()) ports.error();
      } finally {
        opening = false;
      }
    },
  };
}
