import { CompiledCircuit, Noir } from "@noir-lang/noir_js";
import {
  UltraHonkBackend,
  UltraHonkVerifier,
} from "@noir-lang/backend_barretenberg";
import circuit from "../assets/circuit.json";
import vkey from "../assets/circuit-vkey.json";
import { Message } from "./types";

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

export async function submitMessage(message: Message) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...message, proof: Array.from(message.proof!) }),
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
  localStorage.setItem("googleOAuthState", state);
  localStorage.setItem("googleOAuthNonce", nonce);

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
        if (returnedState !== localStorage.getItem("googleOAuthState")) {
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
        localStorage.removeItem("googleOAuthState");
        localStorage.removeItem("googleOAuthNonce");
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

export async function signMessageWithGoogle(message: Message) {
  const messageHash = await hashMessage(message);

  const { error, idToken, tokenPayload, headers } = await signInWithGoogle({
    nonce: messageHash,
  });
  if (error) {
    throw new Error(error);
  }

  return { idToken, tokenPayload, headers };
}

export async function hashMessage(message: Message) {
  const dataToHash = message.text + message.timestamp;
  const messageHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(dataToHash)
  );

  return Array.from(new Uint8Array(messageHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32); // Only using 32 bytes for the nonce
}

export async function getGooglePublicKeys() {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const keys = await response.json();
  return keys.keys;
}

export async function convertPubKey(pubkey: object) {
  const { subtle } = globalThis.crypto;

  const publicKey = await subtle.importKey(
    "jwk",
    pubkey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["verify"]
  );

  const publicKeyJWK = await subtle.exportKey(
    "jwk",
    publicKey
  );
  const modulusBigInt = BigInt(
    "0x" + Buffer.from(publicKeyJWK.n as string, "base64").toString("hex")
  );
  const redcParam = (1n << (2n * 2048n)) / modulusBigInt;

  return { publicKey, modulusBigInt, redcParam };
}

export async function generateProof(
  idToken: string
): Promise<{ proof: Uint8Array; provingTime: number }> {
  // Parse token
  const [headerB64, payloadB64] = idToken.split(".");
  const header = JSON.parse(atob(headerB64));
  const payload = JSON.parse(atob(payloadB64));

  // Fetch Google's public keys and find the correct key based on the 'kid' in the JWT header
  const keys = await getGooglePublicKeys();
  const key = keys.find((k: { kid: string }) => k.kid === header.kid);
  if (!key) {
    throw new Error("No matching key not found");
  }

  const { publicKey, modulusBigInt, redcParam } = await convertPubKey(key);

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

  console.log("Inputs for circuit", JSON.stringify(input));

  // Generate witness and prove
  const startTime = performance.now();
  const { witness } = await noir.execute(input);
  const proof = await backend.generateProof(witness);
  const provingTime = performance.now() - startTime;

  console.log("Proof", proof);

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

export async function instantiateVerifier() {
  const verifier = new UltraHonkVerifier();
  await verifier.instantiate();
}

export async function verifyProof(message: Message) {
  // We need to generate the vkey when circuit is modified. Generated one is saved to vkey.json
  // const backend = new UltraHonkBackend(circuit as CompiledCircuit);
  // const vkey = await backend.getVerificationKey();
  // console.log(JSON.stringify(Array.from(vkey)));

  const verifier = new UltraHonkVerifier();

  // Find the correct key based on the 'kid' in the message
  const keys = await getGooglePublicKeys();
  const key = keys.find((k: { kid: string }) => k.kid === message.kid);
  if (!key) {
    throw new Error("No matching key not found");
  }

  const { modulusBigInt } = await convertPubKey(key);
  const modulusLimbs = splitBigIntToChunks(modulusBigInt, 120, 18);

  const domainUint8Array = new Uint8Array(50);
  domainUint8Array.set(
    Uint8Array.from(new TextEncoder().encode(message.domain))
  );

  const messageHash = await hashMessage(message);
  const messageHashUint8Array = new Uint8Array(32);
  messageHashUint8Array.set(new TextEncoder().encode(messageHash));

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
    ...Array.from(messageHashUint8Array).map(
      (s) => "0x" + s.toString(16).padStart(64, "0")
    )
  );

  const proofData = {
    proof: Uint8Array.from(message.proof!),
    publicInputs,
  };

  const startTime = performance.now();
  await verifier.instantiate({ crsPath: "/tmp" });
  const result = await verifier.verifyProof(proofData, Uint8Array.from(vkey));
  const verificationTime = performance.now() - startTime;

  return { isValid: result, verificationTime };
}
