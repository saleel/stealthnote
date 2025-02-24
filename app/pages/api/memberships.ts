import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { Providers } from "../../lib/providers";

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
    return createMembership(req, res);
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function createMembership(req: NextApiRequest, res: NextApiResponse) {
  const {
    groupId,
    ephemeralPubkey,
    ephemeralPubkeyExpiry,
    provider: providerName,
    proof,
    proofArgs,
  } = req.body;

  const provider = Providers[providerName];

  try {
    const isValid = await provider.verifyProof(
      Uint8Array.from(proof),
      groupId,
      BigInt(ephemeralPubkey),
      new Date(ephemeralPubkeyExpiry),
      proofArgs
    );
    if (!isValid) {
      throw new Error("Invalid proof");
    }

    const { error } = await supabase.from("memberships").insert([
      {
        provider: providerName,
        pubkey: ephemeralPubkey,
        pubkey_expiry: new Date(ephemeralPubkeyExpiry),
        proof: JSON.stringify(proof),
        proof_args: JSON.stringify(proofArgs),
        group_id: groupId,
      },
    ]);

    if (error) {
      throw new Error(
        `Error inserting to membership table: ${error?.message}`
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error registering membership:", error);
    res
      .status(500)
      .json({ success: false, message: "Error registering membership" });
  }
}
