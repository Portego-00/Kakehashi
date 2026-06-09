import { Buffer } from "buffer";
import { inflate } from "pako";

function toUint8Array(input: unknown): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  return new Uint8Array(Buffer.from(String(input ?? "")));
}

export function inflateSync(input: unknown): Buffer {
  const inflated = inflate(toUint8Array(input));
  return Buffer.from(inflated);
}

export default {
  inflateSync,
};
