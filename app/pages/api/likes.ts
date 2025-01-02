import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
  if (req.method === "POST") {
    postLike(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function postLike(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { messageId, like } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Authorization required for internal messages" });
      res.end();
      return;
    }

    const pubkey = authHeader.split(" ")[1];

    if (!messageId || !pubkey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate pubkey
    const { data: membershipData } = await supabase
      .from("memberships")
      .select()
      .eq("pubkey", pubkey)
      .single();

    if (!membershipData || !membershipData.pubkey) {
      return res.status(400).json({ error: "Invalid pubkey" });
    }

    // Check if message already liked
    const { data: existingLike } = await supabase
      .from("likes")
      .select()
      .eq("message_id", messageId)
      .eq("pubkey", pubkey)
      .single();

    if (like && !existingLike) {
      // Like
      await Promise.all([
        supabase.from("likes").insert({
          message_id: messageId,
          pubkey,
        }),
        supabase.rpc("increment_likes_count", {
          message_id: messageId,
        }),
      ]);
    }

    if (!like && existingLike) {
      // Unlike
      await Promise.all([
        supabase
          .from("likes")
          .delete()
          .eq("message_id", messageId)
          .eq("pubkey", pubkey),
        supabase.rpc("decrement_likes_count", {
          message_id: messageId,
        }),
      ]);
    }

    return res.status(200).json({ liked: !existingLike });
  } catch (error) {
    console.error("Error handling like:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
