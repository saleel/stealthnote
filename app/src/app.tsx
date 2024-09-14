import React from "react";
import { CompiledCircuit, Noir } from "@noir-lang/noir_js";
import {
  BarretenbergBackend,
  BarretenbergVerifier as Verifier,
} from "@noir-lang/backend_barretenberg";
import circuit from "../../circuit/target/circuit.json";

function App() {
  const nonce = "dr3bzu51rrjomr7co4wayzmozj5kep0j";

  function splitToWords(
    number: bigint,
    wordsize: bigint,
    numberElement: bigint
  ) {
    let t = number;
    const words: string[] = [];
    for (let i = BigInt(0); i < numberElement; ++i) {
      const baseTwo = BigInt(2);

      words.push(`${t % BigInt(Math.pow(Number(baseTwo), Number(wordsize)))}`);
      t = BigInt(t / BigInt(Math.pow(Number(BigInt(2)), Number(wordsize))));
    }
    if (!(t == BigInt(0))) {
      throw `Number ${number} does not fit in ${(
        wordsize * numberElement
      ).toString()} bits`;
    }
    return words;
  }

  async function generateProof(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: CryptoKey
  ) {
    try {
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
      const signatureBigInt = BigInt(
        "0x" + Buffer.from(signature).toString("hex")
      );

      const redc_parm = (1n << (2n * 2048n)) / modulusBigInt;

      const paddedData = new Uint8Array(1024);
      paddedData.set(data);

      const domainBytes = new Uint8Array(50);
      domainBytes.set(Uint8Array.from(new TextEncoder().encode("aztecprotocol.com")));

      const input = {
        pubkey_modulus_limbs: splitToWords(modulusBigInt, 120n, 18n).map((s) =>
          s.toString()
        ),
        redc_params_limbs: splitToWords(redc_parm, 120n, 18n).map((s) =>
          s.toString()
        ),
        data: Array.from(paddedData).map((s) => s.toString()),
        data_length: data.length,
        signature_limbs: splitToWords(signatureBigInt, 120n, 18n).map((s) =>
          s.toString()
        ),
        domain_name: Array.from(domainBytes).map((s) => s.toString()),
        domain_name_length: "aztecprotocol.com".length,
        nonce: Array.from(new TextEncoder().encode(nonce)).map((s) => s.toString()),
      };

      console.log("input", JSON.stringify(input));
      const { witness } = await noir.execute(input);
      console.time("proof");
      const proof = await backend.generateProof(witness);
      console.timeEnd("proof");
      
      console.log("proof", proof);

      const verified = await backend.verifyProof(proof);
      console.log("verified", verified);
    } catch (error) {
      console.error(error);
    }
  }

  function handleGoogleSignIn() {
    const clientId =
      "654304047015-s536rk3rg5ucgq8pk8t8mjdv1019gb1j.apps.googleusercontent.com";
    const redirectUri = "http://localhost:5173";
    const scope = "email profile";
    const responseType = "id_token";

    const state = Math.random().toString(36).substring(2);
    localStorage.setItem("googleOAuthState", state);

    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=${responseType}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${state}` +
      `&nonce=${nonce}`;

    window.location.href = url;
  }

  const extractAndVerifyToken = async (idToken: string) => {
    try {
      const [headerB64, payloadB64] = idToken.split(".");
      const header = JSON.parse(atob(headerB64));

      console.log("JWT payload", JSON.parse(atob(payloadB64)));

      // Fetch Google's public keys
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/certs"
      );
      const keys = await response.json();

      // Find the correct key based on the 'kid' in the JWT header
      const key = keys.keys.find((k: { kid: string }) => k.kid === header.kid);

      if (!key) {
        throw new Error("Public key not found");
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

      generateProof(data, signature, publicKey);
    } catch (error) {
      console.error("Token verification failed:", error);
      return null;
    }
  };

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const idToken = urlParams.get("id_token");
    const state = urlParams.get("state");

    if (idToken && state) {
      // Verify state to prevent CSRF attacks
      const storedState = localStorage.getItem("googleOAuthState");
      if (state === storedState) {
        localStorage.removeItem("googleOAuthState");
        extractAndVerifyToken(idToken);
      } else {
        console.error("Invalid state parameter");
      }

      // Remove query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <>
      <button id="googleSignIn" onClick={handleGoogleSignIn}>
        Sign in with Google
      </button>
    </>
  );
}

export default App;
