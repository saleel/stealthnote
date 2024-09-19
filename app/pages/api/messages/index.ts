import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyProof } from "../../../lib/utils";

export const maxDuration = 60;

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
  const { id, text, sender, timestamp, domain, kid, proof } =
    await request.body;

  console.log("Received message:", { domain, text });

  await verifyProof({ id, text, sender, timestamp, domain, kid, proof });

  const { error } = await supabase.from("messages").insert([
    {
      id,
      text,
      sender,
      timestamp: new Date(timestamp).toISOString(),
      domain,
      kid,
      proof,
    },
  ]);

  if (error) {
    res.status(500).json({ error: error.message });
    res.end();
    return;
  }

  res.status(201).json({ message: "Message saved successfully" });
  res.end();
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
    .select("id, text, sender, timestamp, domain")
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
