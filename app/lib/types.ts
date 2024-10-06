export interface Message {
  id: string;
  timestamp: number;
  text: string;
  domain: string;
  internal: boolean;
  displayName?: string;
}

export interface SignedMessage extends Message {
  signature: string;
  pubkey: string;
}

export interface SignedMessageWithProof extends SignedMessage {
  proof: Uint8Array; // ZK proof that pubkey is signed using JWT circuit
  kid: string;  // kid of the public key that was used to sign the JWT
}
