export type Message = {
  id: string;
  text: string;
  sender: number;
  timestamp: string;
  domain: string;
  proof?: Uint8Array;
}
