import { type CompiledCircuit, type InputMap } from "@noir-lang/noir_js";
import { generatePartialSHA } from "@zk-email/helpers";
import { initProver, initVerifier } from "../lazy-modules";

export const JWT_CIRCUIT_HELPER = {
  generateProof: async ({
    idToken,
    jwtPubkey,
  }: {
    idToken: string;
    jwtPubkey: bigint; // pubkey modulus in bigint format
  }) => {
    if (!idToken || !jwtPubkey) {
      throw new Error(
        "[JWT Circuit] Proof generation failed: idToken and jwtPubkey are required"
      );
    }

    const inputs = await generateCircuitInputs(idToken, jwtPubkey);

    const { Noir, UltraHonkBackend } = await initProver();
    const circuitArtifact = await import(`../../assets/jwt-0.2.0/circuit.json`);
    const backend = new UltraHonkBackend(circuitArtifact.bytecode);
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
    { nonce, domain, jwtPubKey }: { nonce: string; domain: string; jwtPubKey: bigint }
  ) => {
    if (!nonce || !domain || !jwtPubKey) {
      throw new Error(
        "[JWT Circuit] Proof verification failed: nonce, domain, and jwtPubKey are required"
      );
    }

    const { BarretenbergVerifier } = await initVerifier();

    const vkey = await import(`../../assets/jwt-0.2.0/circuit-vkey.json`);

    const publicInputs = [];

    // Push modulus limbs as 64 char hex strings
    const modulusLimbs = splitBigIntToChunks(jwtPubKey, 120, 18);
    publicInputs.push(
      ...modulusLimbs.map((s) => "0x" + s.toString(16).padStart(64, "0"))
    );

    // Push domain + domain length (BoundedVec)
    const domainUint8Array = new Uint8Array(50);
    domainUint8Array.set(Uint8Array.from(new TextEncoder().encode(domain)));
    publicInputs.push(
      ...Array.from(domainUint8Array).map(
        (s) => "0x" + s.toString(16).padStart(64, "0")
      )
    );
    publicInputs.push("0x" + domain.length.toString(16).padStart(64, "0"));

    // Push nonce - hash of the pubkey which is used as the nonce in JWT
    const nonceUint8Array = new Uint8Array(32);
    nonceUint8Array.set(new TextEncoder().encode(nonce));
    publicInputs.push(
      ...Array.from(nonceUint8Array).map(
        (s) => "0x" + s.toString(16).padStart(64, "0")
      )
    );
    publicInputs.push("0x" + (32).toString(16).padStart(64, "0"));

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

//

async function generateCircuitInputs(idToken: string, jwtPubkey: bigint) {
  // Parse token
  const [headerB64, payloadB64] = idToken.split(".");
  const payload = JSON.parse(atob(payloadB64));
  const domain = payload.hd;

  if (domain.length > 50) {
    throw new Error(
      "Only domain with length less than 50 is supported now. Please create an issue in Github."
    );
  }

  const redcParam = (1n << (2n * 2048n + 4n)) / jwtPubkey;

  const signedDataString = idToken.split(".").slice(0, 2).join("."); // $header.$payload
  const signedData = new TextEncoder().encode(signedDataString);

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

  // Precompute SHA256 of the signed data
  // SHA256 is done in 64 byte chunks, so we can hash upto certain portion outside of circuit to save constraints
  // Signed data is $headerB64.$payloadB64
  // We need to find the index in B64 payload corresponding to min(hdIndex, nonceIndex) when decoded
  // Then we find the 64 byte boundary before this index and precompute the SHA256 upto that
  const payloadString = atob(payloadB64);
  const hdIndex = payloadString.indexOf(`"hd"`);
  const nonceIndex = payloadString.indexOf(`"nonce"`);
  const smallerIndex = Math.min(hdIndex, nonceIndex);
  const smallerIndexInB64 = Math.floor((smallerIndex * 4) / 3); // 4 B64 chars = 3 bytes

  const sliceStart = headerB64.length + smallerIndexInB64 + 1; // +1 for the '.'
  const precomputeSelector = signedDataString.slice(
    sliceStart,
    sliceStart + 12
  ); // 12 is a random slice length

  // generatePartialSHA expects padded input - Noir SHA lib doesn't need padded input; so we simply pad to 64x bytes
  const dataPadded = new Uint8Array(Math.ceil(signedData.length / 64) * 64);
  dataPadded.set(signedData);

  // Precompute the SHA256 hash
  const { precomputedSha, bodyRemaining: bodyRemainingSHAPadded } =
    generatePartialSHA({
      body: dataPadded,
      bodyLength: dataPadded.length,
      selectorString: precomputeSelector,
      maxRemainingBodyLength: 640, // Max length configured in the circuit
    });

  // generatePartialSHA returns the remaining data after the precomputed SHA256 hash including padding
  // We don't need this padding so can we trim to it nearest 64x
  const shaCutoffIndex = Math.floor(sliceStart / 64) * 64; // Index up to which we precomputed SHA256
  const remainingDataLength = signedData.length - shaCutoffIndex;
  const bodyRemaining = bodyRemainingSHAPadded.slice(0, remainingDataLength);
  // Pad to 640 bytes - this is the max length configured in the circuit
  const bodyRemainingPadded = new Uint8Array(640);
  bodyRemainingPadded.set(bodyRemaining);

  // B64 encoding happens serially, so we can decode a portion as long as the indices of the slice is a multiple of 4
  // Since we only pass the data after partial SHA to the circuit, the B64 slice might not be parse-able
  // This is because the first index of partial_data might not be a 4th multiple of original payload B64
  // So we also pass in an offset after which the data in partial_data is a 4th multiple of original payload B64
  // An attacker giving wrong index will fail as incorrectly decoded bytes wont contain "hd" or "nonce"
  const payloadLengthInRemainingData = shaCutoffIndex - headerB64.length - 1; // -1 for the separator '.'
  const b64Offset = 4 - (payloadLengthInRemainingData % 4);

  // Pad domain to 50 bytes
  const domainBytes = new Uint8Array(50);
  domainBytes.set(Uint8Array.from(new TextEncoder().encode(domain)));

  // Function to convert u8 array to u32 array - partial_hash expects u32[8] array
  // new Uint32Array(input.buffer) does not work due to difference in endianness
  // Copied from https://github.com/zkemail/zkemail.nr/blob/main/js/src/utils.ts#L9
  // TODO: Import Mach34 npm package instead when zkemail.nr is ready
  function u8ToU32(input: Uint8Array): Uint32Array {
    const out = new Uint32Array(input.length / 4);
    for (let i = 0; i < out.length; i++) {
      out[i] =
        (input[i * 4 + 0] << 24) |
        (input[i * 4 + 1] << 16) |
        (input[i * 4 + 2] << 8) |
        (input[i * 4 + 3] << 0);
    }
    return out;
  }

  const input = {
    partial_data: {
      storage: Array.from(bodyRemainingPadded).map((s) => s.toString()),
      len: remainingDataLength,
    },
    partial_hash: Array.from(u8ToU32(precomputedSha)).map((s) => s.toString()),
    full_data_length: signedData.length,
    b64_offset: b64Offset,
    pubkey_modulus_limbs: splitBigIntToChunks(jwtPubkey, 120, 18).map((s) =>
      s.toString()
    ),
    redc_params_limbs: splitBigIntToChunks(redcParam, 120, 18).map((s) =>
      s.toString()
    ),
    signature_limbs: splitBigIntToChunks(signatureBigInt, 120, 18).map((s) =>
      s.toString()
    ),
    domain: {
      storage: Array.from(domainBytes).map((s) => s.toString()),
      len: domain.length,
    },
    nonce: {
      storage: Array.from(new TextEncoder().encode(payload.nonce)).map((s) =>
        s.toString()
      ),
      len: payload.nonce.length,
    },
  };

  return input;
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
