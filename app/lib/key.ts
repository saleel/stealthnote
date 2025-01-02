import { LocalStorageKeys, Message, SignedMessage } from "./types";

export async function generateEphemeralKey() {
  const key = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  const privateKey = await crypto.subtle.exportKey("jwk", key.privateKey);
  localStorage.setItem(LocalStorageKeys.PrivateKey, JSON.stringify(privateKey));

  const publicKey = await crypto.subtle.exportKey("jwk", key.publicKey);

  localStorage.setItem(LocalStorageKeys.PublicKey, publicKey.n as string);

  return { publicKey: publicKey.n as string };
}

export function hasEphemeralKey() {
  return localStorage.getItem(LocalStorageKeys.PrivateKey) !== null;
}

export function getEphemeralPubkey() {
  return localStorage.getItem(LocalStorageKeys.PublicKey);
}

export async function signMessage(message: Message) {
  const privateKeyString = localStorage.getItem(LocalStorageKeys.PrivateKey);
  if (!privateKeyString) {
    throw new Error("No privateKey found");
  }

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(privateKeyString),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const pubkeyModulusHex = await getEphemeralPubkey();
  const messageHash = hashMessage(message);

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(messageHash)
  );

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((s) => s.toString(16).padStart(2, "0"))
    .join("");

  return { pubkey: pubkeyModulusHex as string, signature: signatureHex };
}

export async function verifyMessageSignature(message: SignedMessage) {
  const pubkey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      n: message.ephemeralPubkey,
      e: "AQAB", // 65537
      alg: "RS256",
      ext: true,
      key_ops: ["verify"],
    } as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"]
  );

  const messageHash = hashMessage(message);

  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    pubkey,
    Buffer.from(message.signature, "hex"),
    new TextEncoder().encode(messageHash)
  );

  if (!isValid) {
    console.error("Signature verification failed for the message");
  }

  return isValid;
}

function hashMessage(message: Message) {
  // Just concatenate the message fields to hash
  const dataToHash = message.anonGroupId + message.text + message.timestamp;
  return dataToHash;
}
