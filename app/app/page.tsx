'use client';

import React from "react";
import SignInButton from "./components/SignInButton";

export default function Home() {
  return (
    <div className="page">
      <main className="intro">
        <h1 className="title">Welcome to AnonChat</h1>
        <p>
          AnonChat is an application for anonymously sending messages by proving you are part of an organization.
        </p>
        <p>
          You can prove you are part of an organization without revealing any information about yourself using Zero Knowledge Proofs.
        </p>
        <SignInButton />
      </main>
    </div>
  );
}
