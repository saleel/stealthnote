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

  await loadGoogleOAuthScript();

  localStorage.setItem("googleOAuthNonce", nonce);

  return new Promise((resolve, reject) => {
    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string; error: string }) => {
        if (response.error) {
          reject(response.error);
        } else {
          const idTokenStr = response.credential;
          const storedNonce = localStorage.getItem("googleOAuthNonce");

          const tokenPayload = JSON.parse(atob(idTokenStr.split(".")[1]));
          if (tokenPayload.nonce !== storedNonce) {
            reject({ error: "Invalid nonce" });
          }

          localStorage.removeItem("googleOAuthNonce");

          const headers = JSON.parse(atob(idTokenStr.split(".")[0]));
          resolve({ idToken: idTokenStr, tokenPayload, headers });
        }
      },
      nonce: nonce,
      context: "signIn",
    });

    window.google!.accounts.id.prompt();
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

async function getGooglePublicKeys() {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const keys = await response.json();
  return keys.keys;
}

async function convertPubKey(pubkey: object) {
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

  const publicKeyJWK = await globalThis.crypto.subtle.exportKey(
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

function splitBigIntToChunks(
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

export async function verifyProof(
  message: Message,
) {
  // We need to generate the vkey when circuit is modified. Generated one is saved to vkey.json
  // const backend = new UltraHonkBackend(circuit as CompiledCircuit);
  // await backend.getVerificationKey();

  const verifier = new UltraHonkVerifier();

  // Find the correct key based on the 'kid' in the message
  const keys = await getGooglePublicKeys();
  const key = keys.find((k: { kid: string }) => k.kid === message.kid);
  const { modulusBigInt } = await convertPubKey(key);
  const modulusLimbs = splitBigIntToChunks(modulusBigInt, 120, 18);

  // 50 bytes for domain, 32 for messageHash, 18 for modulus chunks
  const publicInputs = new Uint8Array(18 + 50 + 32).fill(0);
  const messageHash = await hashMessage(message);

  publicInputs.set(Uint8Array.from(modulusLimbs.map(s => Number(s))), 0);
  publicInputs.set(new TextEncoder().encode(message.domain), 18);
  publicInputs.set(new TextEncoder().encode(messageHash), 18 + 50);

  const proofData = {
    proof: Uint8Array.from(message.proof!),
    publicInputs: Array.from(publicInputs).map(
      (s) => "0x" + s.toString(16).padStart(64, "0")
    ),
  };

  console.log(proofData);

  const startTime = performance.now();
  await verifier.instantiate();
  const result = await verifier.verifyProof(proofData, Uint8Array.from(vkey));
  const verificationTime = performance.now() - startTime;

  return { isValid: result, verificationTime };
}
