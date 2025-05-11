import { InputMap, type CompiledCircuit } from "@noir-lang/noir_js";
import { generateEmailVerifierInputs } from "@zk-email/zkemail-nr";
import { getAddressHeaderSequence } from "@zk-email/zkemail-nr/dist/utils";
import { initProver, initVerifier } from "../lazy-modules";
import { EphemeralKey } from "../types";
import { splitBigIntToLimbs } from "../utils";

const MAX_DOMAIN_LENGTH = 64;

export const EmailCircuitHelper = {
  version: "0.1.0",
  generateProof: async ({
    email,
    ephemeralKey,
    domain,
  }: {
    email: string;
    ephemeralKey: EphemeralKey;
    domain: string;
  }) => {
    const zkEmailInputs = await generateEmailVerifierInputs(Buffer.from(email), {
      maxHeadersLength: 640,
      ignoreBodyHashCheck: true,
    });

    const domainUint8Array = new Uint8Array(MAX_DOMAIN_LENGTH);
    domainUint8Array.set(Uint8Array.from(new TextEncoder().encode(domain)));

    const fromSequence = getAddressHeaderSequence(
      Buffer.from(Uint8Array.from(zkEmailInputs.header.storage)), "from"
    );

    const toSequence = getAddressHeaderSequence(
      Buffer.from(Uint8Array.from(zkEmailInputs.header.storage)), "to"
    );

    const circuitInputs = {
      email_header: zkEmailInputs.header,
      dkim_pubkey_moulus_limbs: zkEmailInputs.pubkey.modulus,
      dkim_pubkey_redc_params_limbs: zkEmailInputs.pubkey.redc,
      dkim_signature: zkEmailInputs.signature,
      from_header_sequence: fromSequence[0],
      from_address_sequence: fromSequence[1],
      to_header_sequence: toSequence[0],
      to_address_sequence: toSequence[1],
      domain: {
        storage: Array.from(domainUint8Array),
        len: domain.length,
      },
      ephemeral_pubkey: (ephemeralKey.publicKey >> 3n).toString(),
    };

    const { Noir, UltraHonkBackend } = await initProver();
    let circuitArtifact;
    if (zkEmailInputs.pubkey.modulus.length === 18) {
      circuitArtifact = await import(`../../assets/email_2048/circuit.json`);
    } else if (zkEmailInputs.pubkey.modulus.length === 9) {
      circuitArtifact = await import(`../../assets/email_1024/circuit.json`);
    } else {
      throw new Error("[Email Circuit] Unsupported DKIM public key modulus length");
    }

    const backend = new UltraHonkBackend(circuitArtifact.bytecode, { threads: 8 });
    const noir = new Noir(circuitArtifact as CompiledCircuit);

    // Generate witness and prove
    const startTime = performance.now();
    const { witness } = await noir.execute(circuitInputs as InputMap);
    const proof = await backend.generateProof(witness);
    const provingTime = performance.now() - startTime;

    console.log(`Proof generated in ${provingTime}ms`);

    return proof;
  },

  //

  verifyProof: async (
    proof: Uint8Array,
    { domain,
      dkimPubKey,
      ephemeralPubkey
     }:
      {
        domain: string;
        dkimPubKey: bigint;
        ephemeralPubkey: bigint;
      }
  ) => {
    if (!domain || !dkimPubKey || !ephemeralPubkey) {
      throw new Error(
        "[Email Circuit] Proof verification failed: invalid public inputs"
      );
    }

    const rsaKeyLength = dkimPubKey.toString(2).length;
    let limbSize;
    let vkey;

    if (rsaKeyLength === 1024) {
      limbSize = 9;
      vkey = await import(`../../assets/email_1024/vkey.json`);
    } else if (rsaKeyLength === 2048) {
      limbSize = 18;
      vkey = await import(`../../assets/email_2048/vkey.json`);
    } else {
      throw new Error("[Email Circuit] Unsupported DKIM public key length");
    }

    const { BarretenbergVerifier } = await initVerifier();

    // Public Inputs = pubkey_limbs(9 / 18) + domain(64) + ephemeral_pubkey(1)
    const publicInputs = [];

    // Push modulus limbs as 64 char hex strings (18 Fields)
    const modulusLimbs = splitBigIntToLimbs(dkimPubKey, 120, limbSize);
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
