export type LegalDocument = "privacy" | "terms";
/** Public HTTPS pages only. The app never opens arbitrary URL schemes from config. */
export function legalDocumentUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      /localhost|example\.|\.invalid$|\.test$|YOUR_/i.test(url.hostname) ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(":")
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export async function openLegalDocument(
  value: string | undefined,
  open: (url: string) => Promise<unknown>,
): Promise<"opened" | "unconfigured" | "failed"> {
  const url = legalDocumentUrl(value);
  if (!url) return "unconfigured";
  try {
    await open(url);
    return "opened";
  } catch {
    return "failed";
  }
}
