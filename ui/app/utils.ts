import { CompiledCircuit, Noir } from "@noir-lang/noir_js";
import {
  BarretenbergBackend,
  BarretenbergVerifier as Verifier,
} from "@noir-lang/backend_barretenberg";
import circuit from "../../circuit/target/circuit.json";
import { Message } from "./types";

// Add this function to load the Google OAuth script
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
  tokenPayload?: any;
  error?: string;
}> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("Google Client ID is not set");
    return { error: "Google Client ID is not set" };
  }

  // Use the function before initializing the OAuth client
  await loadGoogleOAuthScript();
  // const redirectUri = window.origin;
  // const scope = "email profile openid";

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

          resolve({ idToken: idTokenStr, tokenPayload });
        }
      },
      nonce: nonce,
      login_uri: window.origin,
      parent_origin: window.origin,
    });

    window.google!.accounts.id.prompt();
  });
}

export function verifyNonceAndExtractPayload(idTokenStr: string) {
  console.log("verifyNonceAndExtractPayload", idTokenStr);
  // Verify stored nonce is same as the one in the token
  const storedNonce = localStorage.getItem("googleOAuthNonce");
  if (!idTokenStr || !storedNonce) {
    throw new Error("Invalid token or nonce");
  }

  const tokenPayload = JSON.parse(atob(idTokenStr.split(".")[1]));
  if (tokenPayload.nonce !== storedNonce) {
    throw new Error("Invalid nonce");
  }

  const payload = idTokenStr.split(".")[1];
  return JSON.parse(atob(payload));
}

export async function fetchMessages(domain: string) {
  const response = await fetch(`/api/messages?domain=${domain}`);
  if (response.ok) {
    const data = await response.json();
    return data;
  } else {
    throw new Error("Failed to fetch messages");
  }
}

export async function submitMessage(message: Message, proof: any) {
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, proof }),
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

export async function signMessageWithGoogle(message: Message) {
  const dataToHash = message.text + message.timestamp;
  const messageHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(dataToHash)
  );
  const messageHashHex = Array.from(new Uint8Array(messageHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const nonce = messageHashHex.slice(0, 32);

  console.log({ dataToHash, messageHashHex, nonce });
  const { error, idToken, tokenPayload } = await signInWithGoogle({ nonce });
  if (error) {
    throw new Error(error);
  }

  return { idToken, tokenPayload };
}

export async function generateProof(idToken: string) {
  const [headerB64, payloadB64] = idToken.split(".");
  const header = JSON.parse(atob(headerB64));
  const payload = JSON.parse(atob(payloadB64));

  // Fetch Google's public keys
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const keys = await response.json();

  // Find the correct key based on the 'kid' in the JWT header
  const key = keys.keys.find((k: { kid: string }) => k.kid === header.kid);
  if (!key) {
    throw new Error("No matching key not found");
  }

  //  Verify the signature locally
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    key,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    ["verify"]
  );

  const signatureBase64Url = idToken.split(".")[2];
  const data = new TextEncoder().encode(
    idToken.split(".").slice(0, 2).join(".")
  );

  const signatureBase64 = signatureBase64Url
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const signature = new Uint8Array(
    atob(signatureBase64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  // Verify signature locally
  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    data
  );

  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  const backend = new BarretenbergBackend(circuit as CompiledCircuit);
  const noir = new Noir(circuit as CompiledCircuit);

  const publicKeyJWK = await globalThis.crypto.subtle.exportKey(
    "jwk",
    publicKey
  );
  const modulusBigInt = BigInt(
    "0x" + Buffer.from(publicKeyJWK.n as string, "base64").toString("hex")
  );
  const signatureBigInt = BigInt("0x" + Buffer.from(signature).toString("hex"));

  const redc_parm = (1n << (2n * 2048n)) / modulusBigInt;

  const paddedData = new Uint8Array(1024);
  paddedData.set(data);

  const domainBytes = new Uint8Array(50);
  domainBytes.set(
    Uint8Array.from(new TextEncoder().encode("aztecprotocol.com"))
  );

  const input = {
    pubkey_modulus_limbs: splitBigIntToChunks(modulusBigInt, 120, 18).map((s) =>
      s.toString()
    ),
    redc_params_limbs: splitBigIntToChunks(redc_parm, 120, 18).map((s) =>
      s.toString()
    ),
    data: Array.from(paddedData).map((s) => s.toString()),
    data_length: data.length,
    signature_limbs: splitBigIntToChunks(signatureBigInt, 120, 18).map((s) =>
      s.toString()
    ),
    domain_name: Array.from(domainBytes).map((s) => s.toString()),
    domain_name_length: "aztecprotocol.com".length,
    nonce: Array.from(new TextEncoder().encode(payload.nonce)).map((s) =>
      s.toString()
    ),
  };

  console.log("input", JSON.stringify(input));
  const { witness } = await noir.execute(input);
  console.time("proof");
  const proof = await backend.generateProof(witness);
  console.timeEnd("proof");

  console.log("proof", proof);

  const verified = await backend.verifyProof(proof);
  console.log("verified", verified);
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
