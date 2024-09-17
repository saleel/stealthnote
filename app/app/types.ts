export type Message = {
  id: string;
  text: string;
  sender: number;
  timestamp: number;
  domain: string;
  kid?: string;  // Google public key ID that was used to sign the message
  proof?: Uint8Array;
}
