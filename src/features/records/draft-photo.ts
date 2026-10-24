/** Prepared native photos have exactly one canonical file per operation. Never trust a folder prefix alone. */
export function isPreparedRecordPhoto(
  uri: unknown,
  operationId: string,
  directory: string | null,
  web = false,
): uri is string {
  if (
    typeof uri !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      operationId,
    )
  )
    return false;
  if (web)
    return (
      uri.length <= 14000000 &&
      (uri.length - "data:image/jpeg;base64,".length) % 4 === 0 &&
      /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(uri)
    );
  return !!directory && uri === `${directory}record-drafts/${operationId}.jpg`;
}
