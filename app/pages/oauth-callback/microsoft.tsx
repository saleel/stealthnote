"use client";

import { useEffect } from "react";

export default function MicrosoftOAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (code && state) {
      window.opener.postMessage(
        { type: "MICROSOFT_SIGN_IN_SUCCESS", code, state },
        window.location.origin
      );
    } else if (error) {
      window.opener.postMessage(
        { 
          type: "MICROSOFT_SIGN_IN_ERROR", 
          error,
          errorDescription 
        },
        window.location.origin
      );
    }

    window.close();
  }, []);

  return <div>Processing authentication...</div>;
}
