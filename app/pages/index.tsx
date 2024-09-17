"use client";

import React from "react";
import SignInButton from "../components/siwg";

export default function Home() {
  return (
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
          Sign in with your <u>work Google account</u> (Google Workspace) to get
          started.
        </p>

        <SignInButton />
      </main>
    </div>
  );
}
