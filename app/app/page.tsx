"use client";

import React from "react";
import SignInButton from "./components/siwg";

export default function Home() {
  const [isBrave, setIsBrave] = React.useState(false);

  React.useEffect(() => {
    // @ts-expect-error brave
    if (navigator.brave) {
      // @ts-expect-error brave
      navigator.brave.isBrave().then((isBrave) => {
        setIsBrave(isBrave);
      });
    }
  }, []);

  return (
    <div className="page">
      <main className="intro">
        <h1 className="intro-title">Welcome to AnonChat</h1>
        <p>
          AnonChat is an application for people in an organization to
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

        {isBrave && (
          <p className="text-small mt-3">
            If you are on Brave broswer, sign in with Google might not work
            correctly. Try disabling Brave sheilds for this site, or use a
            different browser if the issue persists.
          </p>
        )}
      </main>
    </div>
  );
}
