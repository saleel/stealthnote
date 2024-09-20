import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { verifyProof } from "../../../lib/utils";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const config = {
  maxDuration: 60,
};

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
  // A hack to make proof verification work in serverless environment
  // Download and write expected files
  fs.writeFileSync(process.env.TEMP_DIR + "/bn254_g1.dat", new Uint8Array()); // g1 is not used
  const response2 = await fetch(
    "https://aztec-ignition.s3.amazonaws.com/MAIN%20IGNITION/flat/g2.dat",
    {
      cache: "force-cache",
    }
  );
  fs.writeFileSync(
    process.env.TEMP_DIR + "/bn254_g2.dat",
    new Uint8Array(await response2.arrayBuffer())
  ); // write g2

  const { id, text, timestamp, domain, kid, proof } = await request.body;

  console.log("Received message:", { domain, text });

  await verifyProof({ id, text, timestamp, domain, kid, proof });

  const { error } = await supabase.from("messages").insert([
    {
      id,
      text,
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
    .select("id, text, timestamp, domain")
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
