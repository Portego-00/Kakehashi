const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GRAVATAR_HASH_PATTERN = /^[a-f\d]{32}$/;

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
] as const;

const MD5_CONSTANTS = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 0x1_0000_0000) >>> 0,
);

function rotateLeft(value: number, shift: number) {
  return (value << shift) | (value >>> (32 - shift));
}

function md5(value: string) {
  const source = new TextEncoder().encode(value);
  const byteLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(byteLength);
  bytes.set(source);
  bytes[source.length] = 0x80;

  const view = new DataView(bytes.buffer);
  const bitLength = source.length * 8;
  view.setUint32(byteLength - 8, bitLength >>> 0, true);
  view.setUint32(byteLength - 4, Math.floor(bitLength / 0x1_0000_0000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < byteLength; offset += 64) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let mixed: number;
      let wordIndex: number;

      if (index < 16) {
        mixed = (b & c) | (~b & d);
        wordIndex = index;
      } else if (index < 32) {
        mixed = (d & b) | (~d & c);
        wordIndex = (5 * index + 1) % 16;
      } else if (index < 48) {
        mixed = b ^ c ^ d;
        wordIndex = (3 * index + 5) % 16;
      } else {
        mixed = c ^ (b | ~d);
        wordIndex = (7 * index) % 16;
      }

      const nextD = c;
      const nextC = b;
      const sum = (a + mixed + MD5_CONSTANTS[index] + view.getUint32(offset + wordIndex * 4, true)) >>> 0;
      const nextB = (b + rotateLeft(sum, MD5_SHIFTS[index])) >>> 0;
      a = d;
      b = nextB;
      c = nextC;
      d = nextD;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0]
    .flatMap((word) => [0, 8, 16, 24].map((shift) => ((word >>> shift) & 0xff).toString(16).padStart(2, "0")))
    .join("");
}

export function normalizeGravatarEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized) ? normalized : "";
}

export function gravatarHash(email: unknown) {
  const normalizedEmail = normalizeGravatarEmail(email);
  if (!normalizedEmail) return null;
  return md5(normalizedEmail);
}

export function gravatarUrlFromHash(hash: unknown, size: number, cacheToken?: string) {
  const normalizedHash = typeof hash === "string" ? hash.trim().toLowerCase() : "";
  if (!GRAVATAR_HASH_PATTERN.test(normalizedHash)) return null;
  const baseUrl = `https://www.gravatar.com/avatar/${normalizedHash}?d=404&s=${Math.ceil(size * 2)}`;
  return cacheToken ? `${baseUrl}&v=${encodeURIComponent(cacheToken)}` : baseUrl;
}

export function gravatarUrl(email: unknown, size: number, cacheToken?: string) {
  return gravatarUrlFromHash(gravatarHash(email), size, cacheToken);
}
