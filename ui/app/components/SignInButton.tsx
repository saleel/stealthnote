'use client';

import React from 'react';
import Image from 'next/image';
import { signInWithGoogle, verifyNonceAndExtractPayload } from '../utils';

const SignInButton = () => {
  function handleGoogleSignIn() {
    signInWithGoogle({ nonce: "init" });
  }

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const idToken = urlParams.get("id_token");
    
    if (idToken) {
      const payload = verifyNonceAndExtractPayload(idToken);
      const domain = payload.hd;

      // Redirect to domains route
      if (domain) {
        if (payload.nonce === "init") {
          window.location.href = `/${domain}`;
        } else {
          window.location.href = `/${domain}?idToken=${idToken}`;
        }
      } else {
        alert("You can use this app with a Google account that is part of an organization.");
      }

      // Remove query parameters from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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