export function mimeFromUri(uri: string): string | undefined {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".bin")) {
    return "application/octet-stream";
  }
  return undefined;
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/jpeg") {
    return "jpg";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "bin";
}

export function isSupportedImageMime(mimeType: string): boolean {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp";
}
