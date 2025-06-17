import type { Message, SignedMessage, SignedMessageWithProof } from "../../types";
import { createMembership, createMessage } from "./api";
import { getEphemeralKey, signMessage, verifyMessageSignature } from "./ephemeral-key";
import { Providers } from "./providers";

export async function registerMembership(
  providerName: keyof typeof Providers,
  args?: object
) {
  // Generate ephemeral key pair and a random salt
  const ephemeralKey = await getEphemeralKey();
  if (!ephemeralKey) {
    throw new Error("No ephemeral key found");
  }

  // Ask the AnonGroup provider to generate a proof
  const provider = Providers[providerName];
  const { anonGroup, proof, proofArgs } = await provider.generateProof(ephemeralKey, args);

  // Send proof to server to create an AnonGroup membership
  await createMembership({
    ephemeralPubkey: ephemeralKey.publicKey.toString(),
    ephemeralPubkeyExpiry: ephemeralKey.expiry,
    groupId: anonGroup.id,
    provider: providerName,
    proof,
    proofArgs,
  });

  return { anonGroup, ephemeralPubkey: ephemeralKey.publicKey.toString(), proofArgs };
}

export async function postMessage(message: Message) {
  // Sign the message with the ephemeral key pair
  const { signature, ephemeralPubkey, ephemeralPubkeyExpiry } = await signMessage(message);
  const signedMessage: SignedMessage = {
    ...message,
    signature: signature,
    ephemeralPubkey: ephemeralPubkey,
    ephemeralPubkeyExpiry: ephemeralPubkeyExpiry,
  };

  // Send the signed message to the server
  await createMessage(signedMessage);

  return signedMessage;
}

export async function verifyMessage(message: SignedMessageWithProof) {
  try {
    if (new Date(message.timestamp).getTime() < new Date("2025-02-23").getTime()) {
      throw new Error(
        "Messages generated before 2025-02-23 are not verifiable due to major changes in the circuit. " +
        "Future versions of this app will be backward compatible."
      );
    }

    // Verify the message signature (signed with sender's ephemeral pubkey)
    let isValid = await verifyMessageSignature(message);
    if (!isValid) {
      throw new Error("Signature verification failed for the message");
    }

    // Verify the proof that the sender (their ephemeral pubkey) belongs to the AnonGroup
    const provider = Providers[message.anonGroupProvider];
    isValid = await provider.verifyProof(
      message.proof,
      message.anonGroupId,
      message.ephemeralPubkey,
      message.ephemeralPubkeyExpiry,
      message.proofArgs
    );

    return isValid;
  } catch (error) {
    alert((error as Error).message);
    throw error;
  }
}
