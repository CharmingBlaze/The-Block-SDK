export function isDataUri(uri: string): boolean {
  return uri.startsWith("data:");
}

export function parseDataUri(uri: string): { mimeType: string; bytes: Uint8Array } | undefined {
  const comma = uri.indexOf(",");
  if (!uri.startsWith("data:") || comma < 0) {
    return undefined;
  }
  const header = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  const mimeType = header.split(";")[0] || "application/octet-stream";
  const bytes = header.includes(";base64")
    ? decodeBase64(payload)
    : new TextEncoder().encode(decodeURIComponent(payload));
  return { mimeType, bytes };
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function toDataUri(bytes: Uint8Array, mimeType = "application/octet-stream"): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
