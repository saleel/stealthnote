import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyMessageSignature } from "../../../lib/key";
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
    const signedMessage = (await request.body);

    const {
      id,
      anonGroupId,
      anonGroupProvider,
      text,
      timestamp,
      internal,
      signature,
      ephemeralPubkey,
    } = signedMessage;

    // Verify pubkey is registered
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("pubkey", ephemeralPubkey)
      .eq("group_id", anonGroupId)
      .eq("provider", anonGroupProvider)
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

    const { error: insertError } = await supabase.from("messages").insert([
      {
        id,
        group_id: anonGroupId,
        group_provider: anonGroupProvider,
        text,
        timestamp: new Date(timestamp).toISOString(),
        signature,
        pubkey: ephemeralPubkey,
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
  const groupId = request.query?.groupId as string;
  const isInternal = request.query?.isInternal === "true";
  const limit = parseInt(request.query?.limit as string) || 50;
  const afterTimestamp = request.query?.afterTimestamp as string;
  const beforeTimestamp = request.query?.beforeTimestamp as string;

  let query = supabase
    .from("messages")
    .select(
      "id, text, timestamp, signature, pubkey, internal, likes, group_id, group_provider"
    )
    .order("timestamp", { ascending: false })
    .limit(limit);

  query = query.eq("internal", !!isInternal);

  if (groupId) {
    query = query.eq("group_id", groupId);
  }

  if (afterTimestamp) {
    query = query.gt(
      "timestamp",
      new Date(Number(afterTimestamp)).toISOString()
    );
  }

  if (beforeTimestamp) {
    query = query.lt(
      "timestamp",
      new Date(Number(beforeTimestamp)).toISOString()
    );
  }

  // Internal messages require a valid pubkey from the same group (as Authorization header)
  if (isInternal) {
    if (!groupId) {
      res
        .status(400)
        .json({ error: "Group ID is required for internal messages" });
      res.end();
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Authorization required for internal messages" });
      res.end();
      return;
    }

    const pubkey = authHeader.split(" ")[1];
    const { data: membershipData, error: membershipError } = await supabase
      .from("memberships")
      .select("*")
      .eq("pubkey", pubkey)
      .eq("group_id", groupId)
      .single();

    if (membershipError || !membershipData) {
      res.status(401).json({ error: "Invalid public key for this group" });
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

  const messages: SignedMessage[] = data.map((message) => ({
    id: message.id,
    anonGroupId: message.group_id,
    anonGroupProvider: message.group_provider,
    text: message.text,
    timestamp: message.timestamp,
    signature: message.signature,
    ephemeralPubkey: message.pubkey,
    internal: message.internal,
    likes: message.likes,
  }));

  res.json(messages);
  res.end();
}
