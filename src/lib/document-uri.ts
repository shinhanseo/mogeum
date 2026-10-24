const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const iosDocuments = new RegExp(
  `^(file:///(?:private/)?var/mobile/Containers/Data/Application/|file:///Users/[^/]+/Library/Developer/CoreSimulator/Devices/${uuid}/data/Containers/Data/Application/)${uuid}/Documents/$`,
  "i",
);
const containerDocuments = new RegExp(`^${uuid}/Documents/$`, "i");

/** Resolve only the exact expected file in the current sandbox. Never read from an old container or arbitrary URI. */
export function currentDocumentUri(
  uri: unknown,
  directory: string | null,
  relative: string,
): string | null {
  if (
    typeof uri !== "string" ||
    !directory ||
    relative
      .split("/")
      .some((part) => !part || part === "." || part === "..") ||
    /[\\?#%]/.test(relative)
  )
    return null;
  const canonical = directory + relative;
  if (uri === canonical) return canonical;
  const current = directory.match(iosDocuments);
  if (!current || !uri.startsWith(current[1]) || !uri.endsWith(relative))
    return null;
  const previousRoot = uri.slice(current[1].length, -relative.length);
  return containerDocuments.test(previousRoot) ? canonical : null;
}
