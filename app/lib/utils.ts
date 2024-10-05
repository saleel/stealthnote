import { CompiledCircuit, Noir } from "@noir-lang/noir_js";
import {
  UltraHonkBackend,
  UltraHonkVerifier,
} from "@noir-lang/backend_barretenberg";
import circuit from "../assets/circuit.json";
import vkey from "../assets/circuit-vkey.json";
import { Message, SignedMessage, SignedMessageWithProof } from "./types";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (params: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export const LocalStorageKeys = {
  Domain: "domain",
  PrivateKey: "privateKey",
  PublicKeyModulus: "publicKey",
  GoogleOAuthState: "googleOAuthState",
  GoogleOAuthNonce: "googleOAuthNonce",
};

export async function fetchMessages(domain: string) {
  const response = await fetch(`/api/messages?domain=${domain}`);
  if (response.ok) {
    const res = await response.json();
    const messages = res.map((message: Message) => {
      message.timestamp = new Date(message.timestamp).getTime();
      return message;
    });

    return messages;
  } else {
    throw new Error("Failed to fetch messages");
  }
}

export async function fetchMessage(id: string) {
  const response = await fetch(`/api/messages/${id}`);
  if (response.ok) {
    const message = await response.json();
    message.timestamp = new Date(message.timestamp).getTime();
    return message;
  } else {
    throw new Error("Failed to fetch message");
  }
}

export async function submitMessage(message: SignedMessage) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (response.ok) {
    return response.json();
  } else {
    let errorMessage = response.statusText;

    try {
      const errorData = await response.json();
      errorMessage = JSON.stringify(errorData);
    } catch (error) {
      //
    }

    throw new Error(errorMessage);
  }
}

async function loadGoogleOAuthScript() {
  return new Promise<void>((resolve) => {
    if (typeof window.google !== "undefined" && window.google.accounts) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

export async function signInWithGoogle({ nonce }: { nonce: string }): Promise<{
  idToken?: string;
  tokenPayload?: { hd: string; nonce: string };
  headers?: { kid: string };
  error?: string;
}> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("Google Client ID is not set");
    return { error: "Google Client ID is not set" };
  }

  try {
    // First, try One Tap sign-in
    return await signInWithGoogleOneTap({ nonce, clientId });
  } catch (error) {
    console.log("One Tap sign-in failed, falling back to popup method", error);
    // If One Tap fails, fall back to popup method
    return signInWithGooglePopup({ nonce, clientId });
  }
}

async function signInWithGooglePopup({
  nonce,
  clientId,
}: {
  nonce: string;
  clientId: string;
}): Promise<{
  idToken?: string;
  tokenPayload?: { hd: string; nonce: string };
  headers?: { kid: string };
}> {
  // Generate a random state
  const state = Math.random().toString(36).substring(2, 15);

  // Store the state and nonce in localStorage
  localStorage.setItem(LocalStorageKeys.GoogleOAuthState, state);
  localStorage.setItem(LocalStorageKeys.GoogleOAuthNonce, nonce);

  // Construct the Google OAuth URL
  const redirectUri = `${window.location.origin}/auth`;
  const scope = "openid email";
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=id_token` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}` +
    `&nonce=${nonce}`;

  // Open the auth window
  const authWindow = window.open(
    authUrl,
    "Google Sign In",
    "width=500,height=600"
  );

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "GOOGLE_SIGN_IN_SUCCESS") {
        const { idToken, state: returnedState } = event.data;

        // Verify the state
        if (
          returnedState !==
          localStorage.getItem(LocalStorageKeys.GoogleOAuthState)
        ) {
          reject(new Error("Invalid state parameter"));
          return;
        }

        // Parse the ID token
        const [headerB64, payloadB64] = idToken.split(".");
        const tokenPayload = JSON.parse(atob(payloadB64));
        const headers = JSON.parse(atob(headerB64));

        // Verify the nonce
        if (tokenPayload.nonce !== nonce) {
          reject(new Error("Invalid nonce"));
          return;
        }

        // Clean up
        localStorage.removeItem(LocalStorageKeys.GoogleOAuthState);
        localStorage.removeItem(LocalStorageKeys.GoogleOAuthNonce);
        window.removeEventListener("message", handleMessage);

        resolve({ idToken, tokenPayload, headers });
      } else if (event.data.type === "GOOGLE_SIGN_IN_ERROR") {
        reject(new Error(event.data.error));
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    // Periodically check if the auth window is still open
    const checkInterval = setInterval(() => {
      if (authWindow && authWindow.closed) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 1000);

    // Set a timeout for the authentication process
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("Authentication timed out"));
    }, 120000); // 2 minutes timeout

    // Clean up the timeout if authentication succeeds
    window.addEventListener(
      "message",
      () => {
        clearTimeout(timeout);
      },
      { once: true }
    );
  });
}

async function signInWithGoogleOneTap({
  nonce,
  clientId,
}: {
  nonce: string;
  clientId: string;
}): Promise<{
  idToken?: string;
  tokenPayload?: { hd: string; nonce: string };
  headers?: { kid: string };
}> {
  await loadGoogleOAuthScript();

  return new Promise((resolve, reject) => {
    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string; error: string }) => {
        if (response.error) {
          reject(response.error);
        } else {
          const idTokenStr = response.credential;
          const [headerB64, payloadB64] = idTokenStr.split(".");
          const tokenPayload = JSON.parse(atob(payloadB64));
          const headers = JSON.parse(atob(headerB64));

          if (tokenPayload.nonce !== nonce) {
            reject({ error: "Invalid nonce" });
          } else {
            resolve({ idToken: idTokenStr, tokenPayload, headers });
          }
        }
      },
      nonce: nonce,
      context: "signin",
    });

    // @ts-expect-error its valid to pass this callback
    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject("One Tap not displayed or skipped");
      }
    });
  });
}

export async function signPubKeyWithGoogle(pubkey: string) {
  const messageHash = await hashPublicKey(pubkey);

  const { error, idToken, tokenPayload, headers } = await signInWithGoogle({
    nonce: messageHash,
  });
  if (error) {
    throw new Error(error);
  }

  return { idToken, tokenPayload, headers };
}

export async function hashMessage(message: Message) {
  const dataToHash = message.domain + message.text + message.timestamp;
  const messageHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(dataToHash)
  );

  return new Uint8Array(messageHash);
}

export async function hashPublicKey(key: string) {
  const messageHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );

  return Array.from(new Uint8Array(messageHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32); // Only using 32 bytes for the nonce
}

export async function fetchGooglePublicKeys() {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const keys = await response.json();
  return keys.keys;
}

export async function parseJWKPubkey(pubkey: object) {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    pubkey,
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
  const redcParam = (1n << (2n * 2048n)) / modulusBigInt;

  return { publicKey, modulusBigInt, redcParam };
}

export async function generateJWTProof(
  idToken: string
): Promise<{ proof: Uint8Array; provingTime: number }> {
  // Parse token
  const [headerB64, payloadB64] = idToken.split(".");
  const header = JSON.parse(atob(headerB64));
  const payload = JSON.parse(atob(payloadB64));

  // Fetch Google's public keys and find the correct key based on the 'kid' in the JWT header
  const keys = await fetchGooglePublicKeys();
  const key = keys.find((k: { kid: string }) => k.kid === header.kid);
  if (!key) {
    throw new Error("No matching Google public key found");
  }

  const { publicKey, modulusBigInt, redcParam } = await parseJWKPubkey(key);

  const signedData = new TextEncoder().encode(
    idToken.split(".").slice(0, 2).join(".")
  );

  const signatureBase64Url = idToken.split(".")[2];
  const signatureBase64 = signatureBase64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const signature = new Uint8Array(
    atob(signatureBase64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const signatureBigInt = BigInt("0x" + Buffer.from(signature).toString("hex"));

  // Verify signature locally
  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData
  );

  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  // Initialize Noir JS
  const backend = new UltraHonkBackend(circuit as CompiledCircuit);
  const noir = new Noir(circuit as CompiledCircuit);

  // Pad data to 1024 bytes
  const paddedData = new Uint8Array(1024);
  paddedData.set(signedData);

  // Pad domain to 50 bytes
  const domainBytes = new Uint8Array(50);
  domainBytes.set(
    Uint8Array.from(new TextEncoder().encode("aztecprotocol.com"))
  );

  const input = {
    pubkey_modulus_limbs: splitBigIntToChunks(modulusBigInt, 120, 18).map((s) =>
      s.toString()
    ),
    redc_params_limbs: splitBigIntToChunks(redcParam, 120, 18).map((s) =>
      s.toString()
    ),
    data: Array.from(paddedData).map((s) => s.toString()),
    data_length: signedData.length,
    signature_limbs: splitBigIntToChunks(signatureBigInt, 120, 18).map((s) =>
      s.toString()
    ),
    domain_name: Array.from(domainBytes).map((s) => s.toString()),
    domain_name_length: "aztecprotocol.com".length,
    nonce: Array.from(new TextEncoder().encode(payload.nonce)).map((s) =>
      s.toString()
    ),
  };

  // Generate witness and prove
  const startTime = performance.now();
  const { witness } = await noir.execute(input);
  const proof = await backend.generateProof(witness);
  const provingTime = performance.now() - startTime;

  return { proof: proof.proof, provingTime };
}

export function splitBigIntToChunks(
  bigInt: bigint,
  chunkSize: number,
  numChunks: number
): bigint[] {
  const chunks: bigint[] = [];
  const mask = (1n << BigInt(chunkSize)) - 1n;
  for (let i = 0; i < numChunks; i++) {
    const chunk = (bigInt / (1n << (BigInt(i) * BigInt(chunkSize)))) & mask;
    chunks.push(chunk);
  }
  return chunks;
}

export async function generateSigningKey() {
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
  localStorage.setItem(
    LocalStorageKeys.PublicKeyModulus,
    publicKey.n as string
  );

  return { publicKeyModulus: publicKey.n };
}

async function getSigningKey() {
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

  return privateKey;
}

export async function getPubkeyString() {
  try {
    const modulus = localStorage.getItem(LocalStorageKeys.PublicKeyModulus);
    return modulus;
  } catch (error) {
    return null;
  }
}

export async function generateKeyPairAndRegister(
  onStatusChange: (status: string) => void = console.log
) {
  onStatusChange("Generating key...");
  const { publicKeyModulus } = await generateSigningKey();

  onStatusChange("Signing with Google...");
  const { idToken, headers, tokenPayload } = await signPubKeyWithGoogle(
    publicKeyModulus as string
  );

  onStatusChange("Generating proof...");
  const { proof } = await generateJWTProof(idToken!);
  const domain = tokenPayload!.hd;

  if (!domain) {
    throw new Error(
      "You can use this app with a Google account that is part of an organization."
    );
  }

  onStatusChange("Registering...");
  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain,
      kid: headers!.kid,
      publicKey: publicKeyModulus as string,
      proof: Array.from(proof),
    }),
  });

  if (!response.ok) {
    throw new Error("Call to /register API failed");
  }

  window.localStorage.setItem(LocalStorageKeys.Domain, domain);
  onStatusChange("Done!");
}

export function isRegistered() {
  return (
    window.localStorage.getItem(LocalStorageKeys.Domain) !== null &&
    window.localStorage.getItem(LocalStorageKeys.PublicKeyModulus) !== null &&
    window.localStorage.getItem(LocalStorageKeys.PrivateKey) !== null
  );
}

export function getDomain() {
  return window.localStorage.getItem(LocalStorageKeys.Domain);
}

export async function signMessage(message: Message) {
  const privateKey = await getSigningKey();
  const pubkey = await getPubkeyString();
  const messageHash = await hashMessage(message);

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, messageHash);

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((s) => s.toString(16).padStart(2, "0"))
    .join("");

  return { pubkey, signatureHex };
}

export async function verifyPubkeyZKProof(
  domain: string,
  pubkey: string,
  kid: string,
  proof: Uint8Array
) {
  // We need to generate the vkey when circuit is modified. Generated one is saved to vkey.json
  // const backend = new UltraHonkBackend(circuit as CompiledCircuit);
  // const newVkey = await backend.getVerificationKey();
  // console.log(JSON.stringify(Array.from(newVkey)));

  // Hash of the pubkey which is used as the nonce in JWT
  const pubkeyHash = await hashPublicKey(pubkey);

  // Find the correct key based on the 'kid' in the message
  const keys = await fetchGooglePublicKeys();
  const key = keys.find((k: { kid: string }) => k.kid === kid);
  if (!key) {
    throw new Error("No matching key not found");
  }

  const { modulusBigInt } = await parseJWKPubkey(key);
  const modulusLimbs = splitBigIntToChunks(modulusBigInt, 120, 18);

  const domainUint8Array = new Uint8Array(50);
  domainUint8Array.set(Uint8Array.from(new TextEncoder().encode(domain)));

  const pubkeyHashUint8Array = new Uint8Array(32);
  pubkeyHashUint8Array.set(new TextEncoder().encode(pubkeyHash));

  const publicInputs = [];

  // Push modulus limbs as 64 char hex strings
  publicInputs.push(
    ...modulusLimbs.map((s) => "0x" + s.toString(16).padStart(64, "0"))
  );
  publicInputs.push(
    ...Array.from(domainUint8Array).map(
      (s) => "0x" + s.toString(16).padStart(64, "0")
    )
  );
  publicInputs.push(
    ...Array.from(pubkeyHashUint8Array).map(
      (s) => "0x" + s.toString(16).padStart(64, "0")
    )
  );

  const proofData = {
    proof: proof,
    publicInputs,
  };

  const verifier = new UltraHonkVerifier();
  const result = await verifier.verifyProof(proofData, Uint8Array.from(vkey));

  return result;
}

export async function verifyMessage(message: SignedMessageWithProof) {
  const pubkey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      n: message.pubkey,
      e: "AQAB", // 65537
      alg: "RS256",
      ext: true,
      key_ops: ["verify"],
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"]
  );

  const messageHash = await hashMessage(message);

  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    pubkey,
    Buffer.from(message.signature, "hex"),
    messageHash
  );

  if (!isValid) {
    console.error("Signature verification failed for the message");
    return false;
  }

  return verifyPubkeyZKProof(
    message.domain,
    message.pubkey,
    message.kid!,
    message.proof!
  );
}
