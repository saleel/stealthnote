import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { SignedMessageWithProof } from "../../../lib/types";

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
    getSingleMessage(req, res);
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function getSingleMessage(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ error: "Message ID is required" });
    res.end();
    return;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, text, timestamp, domain, signature, pubkey, internal, pubkeys(kid, proof)")
    .eq("id", id)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    res.end();
    return;
  }

  if (!data) {
    res.status(404).json({ error: "Message not found" });
    res.end();
    return;
  }

  if (data.internal) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: "Authorization required for internal messages" });
      res.end();
      return;
    }

    const publicKey = authHeader.split(' ')[1];
    const { data: pubkeyData, error: pubkeyError } = await supabase
      .from("pubkeys")
      .select("*")
      .eq("pubkey", publicKey)
      .eq("domain", data.domain)
      .single();

    if (pubkeyError || !pubkeyData) {
      res.status(401).json({ error: "Invalid public key for this domain" });
      res.end();
      return;
    }
  }

  const message : SignedMessageWithProof = {
    id: data.id,
    text: data.text,
    timestamp: data.timestamp,
    domain: data.domain,
    signature: data.signature,
    pubkey: data.pubkey,
    internal: data.internal,
    // @ts-expect-error pubkeys is not array
    proof: JSON.parse(data.pubkeys.proof),
    // @ts-expect-error pubkeys is not array
    kid: data.pubkeys.kid,
  }

  res.json(message);
  res.end();
}