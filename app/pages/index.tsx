"use client";

import React, { useState } from "react";
import {
  generateKeyPairAndRegister,
  getDomain,
  isRegistered,
} from "../lib/utils";
import Head from "next/head";
import SignInButton from "../components/siwg";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [status, setStatus] = useState("");
  const router = useRouter();

  async function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    try {
      if (!isRegistered()) {
        await generateKeyPairAndRegister(setStatus);
      }
      const domain = getDomain();
      if (domain) {
        router.push(`/${domain}`);
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus(`Error: ${(error as Error).message}`);
    }
  }

  return (
    <>
      <Head>
        <title>StealthNote</title>
      </Head>

      <div className="page">
        <main className="intro">
          <h1 className="intro-title">Welcome to StealthNote</h1>
          <p>
            StealthNote is an application for people in an organization to
            anonymously broadcast messages.
          </p>
          <p>
            We use Zero Knowledge Proofs to prove that you are part of an
            organization without revealing any information about yourself.
          </p>
          <p>
            Sign in with your <u>work Google account</u> (
            <span className="inline-code">you@company.com</span>) to get
            started.
          </p>

          <SignInButton onClick={onClick} />

          <p>{status}</p>
        </main>
      </div>
    </>
  );
}
