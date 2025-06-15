import { AnonGroupProvider, EphemeralKey } from "./types";
import { pubkeyModulusFromJWK } from "./utils";
import { generateInputs } from "noir-jwt";
import { InputMap, type CompiledCircuit } from "@noir-lang/noir_js";
import { splitBigIntToLimbs } from "./utils";

const MAX_DOMAIN_LENGTH = 64;

/**
 * GoogleOAuth AnonGroupProvider for people in a company (using company domain in Google Workspace account)
 */
export const GoogleOAuthProvider: AnonGroupProvider = {
  //
  name: () => "google-oauth",
  //
  getSlug: () => "domain",
  //
  generateProof: async (ephemeralKey: EphemeralKey, { idToken }: { idToken: string }) => {
    const [headersB64, payloadB64] = idToken.split(".");
    const headers = JSON.parse(atob(headersB64));
    const payload = JSON.parse(atob(payloadB64));

    const domain = payload.hd;
    if (!domain) {
      throw new Error(
        "You can use this app with a Google account that is part of an organization."
      );
    }

    // Get Google pubkey
    const keyId = headers.kid;
    const jwtPubkey = await fetchGooglePublicKey(keyId);

    if (!idToken || !jwtPubkey) {
      throw new Error(
        "[JWT Circuit] Proof generation failed: idToken and jwtPubkey are required"
      );
    }

    const jwtInputs = await generateInputs({
      jwt: idToken,
      pubkey: jwtPubkey,
      shaPrecomputeTillKeys: ["email", "email_verified", "nonce"],
      maxSignedDataLength: 640,
    });

    const domainUint8Array = new Uint8Array(MAX_DOMAIN_LENGTH);
    domainUint8Array.set(Uint8Array.from(new TextEncoder().encode(domain)));

    const inputs = {
      partial_data: jwtInputs.partial_data,
      partial_hash: jwtInputs.partial_hash,
      full_data_length: jwtInputs.full_data_length,
      base64_decode_offset: jwtInputs.base64_decode_offset,
      jwt_pubkey_modulus_limbs: jwtInputs.pubkey_modulus_limbs,
      jwt_pubkey_redc_params_limbs: jwtInputs.redc_params_limbs,
      jwt_signature_limbs: jwtInputs.signature_limbs,
      ephemeral_pubkey: (ephemeralKey.publicKey >> 3n).toString(),
      ephemeral_pubkey_salt: ephemeralKey.salt.toString(),
      ephemeral_pubkey_expiry: Math.floor(ephemeralKey.expiry.getTime() / 1000).toString(),
      domain: {
        storage: Array.from(domainUint8Array),
        len: domain.length,
      },
    };

    console.log("JWT circuit inputs", inputs);

    const { Noir } = await import("@noir-lang/noir_js");
    const { UltraHonkBackend } = await import("@aztec/bb.js");

    const circuitArtifact = await import(`../artifacts/circuit.json`);
    const backend = new UltraHonkBackend(circuitArtifact.bytecode, { threads: 8 });
    const noir = new Noir(circuitArtifact as CompiledCircuit);

    // Generate witness and prove
    const startTime = performance.now();
    const { witness } = await noir.execute(inputs as InputMap);
    const proof = await backend.generateProof(witness);
    const provingTime = performance.now() - startTime;

    console.log(`Proof generated in ${provingTime}ms`);

    const anonGroup = GoogleOAuthProvider.getAnonGroup(domain);

    const proofArgs = {
      keyId,
      jwtCircuitVersion: "0.3.1",
    };

    return {
      proof: proof.proof,
      anonGroup,
      proofArgs,
    };
  },
  //
  verifyProof: async (
    proof: Uint8Array,
    anonGroupId: string,
    ephemeralPubkey: bigint,
    ephemeralPubkeyExpiry: Date,
    proofArgs: { keyId: string, jwtCircuitVersion: string }
  ) => {
    if (proofArgs.jwtCircuitVersion !== "0.3.1") {
      throw new Error(
        'This proof was generated with an older version of StealthNote JWT circuit and ' +
        'cannot be verified at this time. You can run an older version of the app to verify this proof.'
      );
    }

    // Verify the pubkey belongs to Google
    const googlePubkeyJWK = await fetchGooglePublicKey(proofArgs.keyId);
    if (!googlePubkeyJWK) {
      throw new Error(
        "[Google OAuth] Proof verification failed: could not validate Google public key."
      );
    }
    const googleJWTPubkeyModulus = await pubkeyModulusFromJWK(googlePubkeyJWK);
    const domain = anonGroupId;
  
    if (!domain || !googleJWTPubkeyModulus || !ephemeralPubkey || !ephemeralPubkeyExpiry) {
      throw new Error(
        "[JWT Circuit] Proof verification failed: invalid public inputs"
      );
    }

    const { BarretenbergVerifier } = await import("@aztec/bb.js");

    const vkey = await import(`../artifacts/vkey.json`);

    // Public Inputs = pubkey_limbs(18) + domain(64) + ephemeral_pubkey(1) + ephemeral_pubkey_expiry(1) = 84
    const publicInputs: string[] = [];

    // Push modulus limbs as 64 char hex strings (18 Fields)
    const modulusLimbs = splitBigIntToLimbs(googleJWTPubkeyModulus, 120, 18);
    publicInputs.push(
      ...modulusLimbs.map((s) => "0x" + s.toString(16).padStart(64, "0"))
    );

    // Push domain + domain length (BoundedVec of 64 bytes)
    const domainUint8Array = new Uint8Array(64);
    domainUint8Array.set(Uint8Array.from(new TextEncoder().encode(domain)));
    publicInputs.push(
      ...Array.from(domainUint8Array).map(
        (s) => "0x" + s.toString(16).padStart(64, "0")
      )
    );
    publicInputs.push("0x" + domain.length.toString(16).padStart(64, "0"));

    // Push ephemeral pubkey (1 Field)
    publicInputs.push("0x" + (ephemeralPubkey >> 3n).toString(16).padStart(64, "0"));

    // Push ephemeral pubkey expiry (1 Field)
    publicInputs.push("0x" + Math.floor(ephemeralPubkeyExpiry.getTime() / 1000).toString(16).padStart(64, "0"));

    const proofData = {
      proof: proof,
      publicInputs,
    };

    const verifier = new BarretenbergVerifier({
      crsPath: process.env.TEMP_DIR,
    });
    const result = await verifier.verifyUltraHonkProof(
      proofData,
      Uint8Array.from(vkey)
    );

    return result;
  },
  //
  getAnonGroup: (anonGroupId: string) => {
    return {
      id: anonGroupId,
      title: anonGroupId,
      logoUrl: `https://img.logo.dev/${anonGroupId}?token=pk_SqdEexoxR3akcyJz7PneXg`,
    };
  },
};


export async function fetchGooglePublicKey(keyId: string) {
  if (!keyId) {
    return null;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const keys = await response.json();

  const key = keys.keys.find((key: { kid: string }) => key.kid === keyId);
  if (!key) {
    console.error(`Google public key with id ${keyId} not found`);
    return null;
  }

  return key;
}
