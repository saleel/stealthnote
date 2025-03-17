import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyMessageSignature } from "../../../lib/ephemeral-key";
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
    const body = (await request.body);

    const signedMessage: SignedMessage = {
      id: body.id,
      anonGroupId: body.anonGroupId,
      anonGroupProvider: body.anonGroupProvider,
      text: body.text,
      timestamp: new Date(body.timestamp),
      internal: body.internal,
      signature: BigInt(body.signature),
      ephemeralPubkey: BigInt(body.ephemeralPubkey),
      ephemeralPubkeyExpiry: new Date(body.ephemeralPubkeyExpiry),
      likes: 0,
    }

    // Verify pubkey is registered
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("pubkey", signedMessage.ephemeralPubkey.toString())
      .eq("group_id", signedMessage.anonGroupId)
      .eq("provider", signedMessage.anonGroupProvider)
      .single();

    if (error) {
      throw error;
    }

    if (!data.pubkey) {
      throw new Error("Pubkey not registered");
    }

    if (signedMessage.ephemeralPubkeyExpiry < new Date()) {
      throw new Error("Ephemeral pubkey expired");
    }

    const isValid = await verifyMessageSignature(signedMessage);
    if (!isValid) {
      throw new Error("Message signature check failed");
    }

    const { error: insertError } = await supabase.from("messages").insert([
      {
        id: signedMessage.id,
        group_id: signedMessage.anonGroupId,
        group_provider: signedMessage.anonGroupProvider,
        text: signedMessage.text,
        timestamp: signedMessage.timestamp.toISOString(),
        signature: signedMessage.signature.toString(),
        pubkey: signedMessage.ephemeralPubkey.toString(),
        internal: signedMessage.internal,
      },
    ]);

    if (insertError) {
      throw insertError;
    }

    res.status(201).json({ message: "Message saved successfully" });
    res.end();
  } catch (error) {
    console.error(error);
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
    console.error(error);
    res.status(500).json({ error: error.message });
    res.end();
    return;
  }

  const messages: Partial<SignedMessage>[] = data.map((message) => ({
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
