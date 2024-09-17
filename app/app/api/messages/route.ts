import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
// import { UltraHonkVerifier } from "@noir-lang/backend_barretenberg";
// import vkey from "../../../assets/circuit-vkey.json";
// import { verifyProof } from '../../core';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  const { id, text, sender, timestamp, domain, kid, proof } =
    await request.json();

  console.log("Received message:", {
    text,
    sender,
    timestamp,
    domain,
    kid,
    proof,
  });

  // TODO: Verify proof in server before writing to DB - currently failing with bbjs
  // try {
  //   const verifier = new UltraHonkVerifier();
  //   await verifier.instantiate();
  //   const result = await verifier.verifyProof(
  //     { proof: Uint8Array.from(proof), publicInputs: [] },
  //     Uint8Array.from(vkey)
  //   );

  //   if (!result) {
  //     throw new Error("Proof verification failed");
  //   }
  // } catch (error) {
  //   console.log("error", error);
  //   return NextResponse.json(
  //     { error: "Proof verification failed" },
  //     { status: 400 }
  //   );
  // }

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
    console.log("error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { message: "Message saved successfully" },
    { status: 201 }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, text, sender, timestamp, domain")
    .eq("domain", domain)
    .order("timestamp", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
