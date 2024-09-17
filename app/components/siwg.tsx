"use client";

import React from "react";
import Image from "next/image";
import { signInWithGoogle } from "../lib/utils";

const SignInButton = () => {
  async function handleGoogleSignIn() {
    const { tokenPayload, error } = await signInWithGoogle({ nonce: "init" });

    if (error) {
      alert(error);
      return;
    }

    const domain = tokenPayload!.hd;

    // Redirect to domains route
    if (domain) {
      window.location.href = `/${domain}`;
    } else {
      alert(
        "You can use this app with a Google account that is part of an organization."
      );
    }
  }

  
  return (
    <button onClick={handleGoogleSignIn} className="google-sign-in-button">
      <Image
        src="https://developers.google.com/identity/images/g-logo.png"
        alt="Google logo"
        width={24}
        height={24}
      />
      <span>Sign in with Google</span>
    </button>
  );
};

export default SignInButton;
