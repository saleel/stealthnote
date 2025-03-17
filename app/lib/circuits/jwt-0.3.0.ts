import { generateInputs } from "noir-jwt";
import { InputMap, type CompiledCircuit } from "@noir-lang/noir_js";
import { initProver, initVerifier } from "../lazy-modules";
import { EphemeralKey } from "../types";
import { splitBigIntToLimbs } from "../utils";

const MAX_DOMAIN_LENGTH = 64;

export const JWT_CIRCUIT_HELPER = {
  generateProof: async ({
    idToken,
    jwtPubkey,
    ephemeralKey,
    domain,
  }: {
    idToken: string;
    jwtPubkey: JsonWebKey;
    ephemeralKey: EphemeralKey;
    domain: string;
  }) => {
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

    const { Noir, UltraHonkBackend } = await initProver();
    const circuitArtifact = await import(`../../assets/jwt-0.3.0/circuit.json`);
    const backend = new UltraHonkBackend(circuitArtifact.bytecode, { threads: 8 });
    const noir = new Noir(circuitArtifact as CompiledCircuit);

    // Generate witness and prove
    const startTime = performance.now();
    const { witness } = await noir.execute(inputs as InputMap);
    const proof = await backend.generateProof(witness);
    const provingTime = performance.now() - startTime;

    console.log(`Proof generated in ${provingTime}ms`);

    return proof;
  },

  //

  verifyProof: async (
    proof: Uint8Array,
    { domain,
      jwtPubKey,
      ephemeralPubkey,
      ephemeralPubkeyExpiry }:
      {
        domain: string;
        jwtPubKey: bigint;
        ephemeralPubkey: bigint;
        ephemeralPubkeyExpiry: Date;
      }
  ) => {
    if (!domain || !jwtPubKey || !ephemeralPubkey || !ephemeralPubkeyExpiry) {
      throw new Error(
        "[JWT Circuit] Proof verification failed: invalid public inputs"
      );
    }

    const { BarretenbergVerifier } = await initVerifier();

    const vkey = await import(`../../assets/jwt-0.3.0/circuit-vkey.json`);

    // Public Inputs = pubkey_limbs(18) + domain(64) + ephemeral_pubkey(1) + ephemeral_pubkey_expiry(1) = 84
    const publicInputs = [];

    // Push modulus limbs as 64 char hex strings (18 Fields)
    const modulusLimbs = splitBigIntToLimbs(jwtPubKey, 120, 18);
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
};
