export type Message = {
  id: string;
  text: string;
  sender: number;
  timestamp: number;
  domain: string;
  proof?: Uint8Array;
}
