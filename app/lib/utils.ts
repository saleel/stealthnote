import {
  uniqueNamesGenerator,
  Config,
  adjectives,
  animals,
} from "unique-names-generator";

export function getLogoUrl(domain: string) {
  return `https://img.logo.dev/${domain}?token=pk_SqdEexoxR3akcyJz7PneXg`;
}

export function generateNameFromPubkey(pubkey: string): string {
  // Generate a deterministic seed from the pubkey using a simple hash function
  const seed = simpleHash(pubkey);

  const customConfig: Config = {
    dictionaries: [adjectives, animals],
    separator: " ",
    length: 2,
    seed: seed,
    style: "capital",
  };

  return uniqueNamesGenerator(customConfig);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export async function pubkeyModulusFromJWK(jwk: JsonWebKey) {
  // Parse pubkeyJWK
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["verify"]
  );

  const publicKeyJWK = await crypto.subtle.exportKey("jwk", publicKey);
  const modulusBigInt = BigInt(
    "0x" + Buffer.from(publicKeyJWK.n as string, "base64").toString("hex")
  );

  return modulusBigInt;
}

export function bytesToBigInt(bytes: Uint8Array) {
  let result = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    result = (result << BigInt(8)) + BigInt(bytes[i]);
  }
  return result;
}

export function bigIntToBytes(bigInt: bigint, length: number) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[length - 1 - i] = Number(bigInt >> BigInt(i * 8) & BigInt(0xff));
  }
  return bytes;
}

export function splitBigIntToLimbs(
  bigInt: bigint,
  byteLength: number,
  numLimbs: number
): bigint[] {
  const chunks: bigint[] = [];
  const mask = (1n << BigInt(byteLength)) - 1n;
  for (let i = 0; i < numLimbs; i++) {
    const chunk = (bigInt / (1n << (BigInt(i) * BigInt(byteLength)))) & mask;
    chunks.push(chunk);
  }
  return chunks;
}
