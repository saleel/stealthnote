import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyMessage } from "../../../lib/utils";
import { SignedMessage, SignedMessageWithProof } from "../../../lib/types";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    getMessage(req, res);
  } else if (req.method === "POST") {
    postMessage(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export async function postMessage(
  request: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const signedMessage = (await request.body) as SignedMessage;
    const { id, text, timestamp, domain, signature, pubkey } = signedMessage;

    // Verify pubkey is registered
    const { data, error } = await supabase
      .from("pubkeys")
      .select("*")
      .eq("pubkey", pubkey)
      .eq("domain", domain)
      .single();

    if (error) {
      throw error;
    }

    const signedMessageWithProof: SignedMessageWithProof = {
      ...signedMessage,
      proof: data?.proof,
      kid: data?.kid,
    };

    const isValid = await verifyMessage(signedMessageWithProof);
    if (!isValid) {
      throw new Error("Message verification failed");
    }

    console.log("Message is valid");
    const { error: insertError } = await supabase.from("messages").insert([
      {
        id,
        text,
        timestamp: new Date(timestamp).toISOString(),
        domain,
        signature,
        pubkey,
      },
    ]);

    if (insertError) {
      throw insertError;
    }

    res.status(201).json({ message: "Message saved successfully" });
    res.end();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
    res.end();
  }
}

export async function getMessage(
  request: NextApiRequest,
  res: NextApiResponse
) {
  const domain = request.query?.domain;

  if (!domain) {
    res.status(400).json({ error: "Domain is required" });
    res.end();
    return;
  }

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, text, timestamp, domain, signature, pubkey"
    )
    .eq("domain", domain)
    .order("timestamp", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    res.end();
    return;
  }

  res.json(data);
  res.end();
}
