export interface Message {
  id: string;
  timestamp: number;
  text: string;
  domain: string;
  internal: boolean;
}

export interface SignedMessage extends Message {
  signature: string;
  pubkey: string; // Pubkey modulus (n) - exp is 65537
}

export interface SignedMessageWithProof extends SignedMessage {
  proof: Uint8Array; // ZK proof that pubkey is signed using JWT circuit
  kid: string;  // kid of the public key that was used to sign the JWT
}
