export interface Message {
  id: string;
  timestamp: number;
  text: string;
  domain: string;
  internal: boolean;
  displayName?: string;
  likes: number;
}

export interface SignedMessage extends Message {
  signature: string;
  pubkey: string;
}

export interface SignedMessageWithProof extends SignedMessage {
  circuit: string; // Name (version) of the circuit that was used to generate the proof
  proof: Uint8Array; // ZK proof that pubkey is signed using JWT circuit
  kid: string;  // kid of the public key that was used to sign the JWT
}
