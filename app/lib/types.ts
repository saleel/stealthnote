export type Message = {
  id: string;
  text: string;
  timestamp: number;
  domain: string;
}

export type SignedMessage = Message & {
  signature: string;
  pubkey: string; // Pubkey modulus (n) - exp is 65537
}

export type SignedMessageWithProof = SignedMessage & {
  proof: Uint8Array; // ZK proof that pubkey is signed using JWT circuit
  kid: string;  // kid of the public key that was used to sign the JWT
}
