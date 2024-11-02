import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyMessageSignature } from "../../../lib/utils";
import { SignedMessage } from "../../../lib/types";

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
    fetchMessages(req, res);
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
    const { id, text, timestamp, domain, signature, pubkey, internal } = signedMessage;

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

    if (!data.pubkey) {
      throw new Error("Pubkey not registered");
    }

    const isValid = await verifyMessageSignature(signedMessage);
    if (!isValid) {
      throw new Error("Message signature check failed");
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
        internal,
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

export async function fetchMessages(
  request: NextApiRequest,
  res: NextApiResponse
) {
  const domain = request.query?.domain as string;
  const isInternal = request.query?.isInternal === 'true';
  const limit = parseInt(request.query?.limit as string) || 50;
  const afterTimestamp = request.query?.afterTimestamp as string;
  const beforeTimestamp = request.query?.beforeTimestamp as string;

  let query = supabase
    .from("messages")
    .select("id, text, timestamp, domain, signature, pubkey, internal, likes")
    .eq("internal", isInternal)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (domain) {
    query = query.eq("domain", domain);
  }

  if (afterTimestamp) {
    query = query.gt("timestamp", new Date(Number(afterTimestamp)).toISOString());
  }

  if (beforeTimestamp) {
    query = query.lt("timestamp", new Date(Number(beforeTimestamp)).toISOString());
  }

  if (isInternal) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: "Authorization required for internal messages" });
      res.end();
      return;
    }

    const pubkey = authHeader.split(' ')[1];
    const { data: pubkeyData, error: pubkeyError } = await supabase
      .from("pubkeys")
      .select("*")
      .eq("pubkey", pubkey)
      .eq("domain", domain)
      .single();

    if (pubkeyError || !pubkeyData) {
      res.status(401).json({ error: "Invalid public key for this domain" });
      res.end();
      return;
    }
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    res.end();
    return;
  }

  res.json(data);
  res.end();
}
