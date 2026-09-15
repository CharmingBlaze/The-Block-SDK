/** RFC 4648 base64, no Node `Buffer` dependency. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < len ? bytes[i + 1]! : 0;
    const c = i + 2 < len ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += ALPHABET[(triple >> 18) & 63];
    out += ALPHABET[(triple >> 12) & 63];
    out += i + 1 < len ? ALPHABET[(triple >> 6) & 63] : "=";
    out += i + 2 < len ? ALPHABET[triple & 63] : "=";
  }
  return out;
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const outLen = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLen);
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (decodeChar(clean[i]!) << 18) |
      (decodeChar(clean[i + 1]!) << 12) |
      (decodeChar(clean[i + 2] ?? "A") << 6) |
      decodeChar(clean[i + 3] ?? "A");
    if (offset < out.length) {
      out[offset++] = (n >> 16) & 255;
    }
    if (offset < out.length) {
      out[offset++] = (n >> 8) & 255;
    }
    if (offset < out.length) {
      out[offset++] = n & 255;
    }
  }
  return out;
}

function decodeChar(char: string): number {
  if (char >= "A" && char <= "Z") {
    return char.charCodeAt(0) - 65;
  }
  if (char >= "a" && char <= "z") {
    return char.charCodeAt(0) - 71;
  }
  if (char >= "0" && char <= "9") {
    return char.charCodeAt(0) + 4;
  }
  if (char === "+") {
    return 62;
  }
  if (char === "/") {
    return 63;
  }
  return 0;
}
