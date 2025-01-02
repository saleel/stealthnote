import type { Message, SignedMessage, SignedMessageWithProof } from "./types";
import { createMembership, createMessage } from "./api";
import { generateEphemeralKey, signMessage, verifyMessageSignature } from "./key";
import { initProver } from "./lazy-modules";
import { Providers } from "./providers";

export async function generateKeyPairAndRegister(
  providerName: keyof typeof Providers
) {
  // Initialize prover without await to preload aztec bundle
  initProver();

  // Generate ephemeral key pair
  const { publicKey } = await generateEphemeralKey();

  // Create proof with provider
  const provider = Providers[providerName];
  const { anonGroup, proof, proofArgs } = await provider.generateProof(publicKey);

  await createMembership({
    ephemeralPubkey: publicKey,
    groupId: anonGroup.id,
    provider: providerName,
    proof,
    proofArgs,
  });

  return { anonGroup, ephemeralPubkey: publicKey, proofArgs };
}

export async function postMessage(message: Message) {
  const { signature, pubkey } = await signMessage(message);
  const signedMessage: SignedMessage = {
    ...message,
    signature: signature,
    ephemeralPubkey: pubkey,
  };

  await createMessage(signedMessage);

  return signedMessage;
}

export async function verifyMessage(message: SignedMessageWithProof) {
  let isValid = await verifyMessageSignature(message);
  if (!isValid) {
    return false;
  }

  const provider = Providers[message.anonGroupProvider];
  isValid = await provider.verifyProof(
    message.proof,
    message.ephemeralPubkey,
    message.anonGroupId,
    message.proofArgs
  );

  return isValid;
}
