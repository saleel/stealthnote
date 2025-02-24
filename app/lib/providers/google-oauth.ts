import { JWT_CIRCUIT_HELPER } from "../circuits/jwt-0.3.0";
import { AnonGroupProvider, EphemeralKey, LocalStorageKeys } from "../types";
import { pubkeyModulusFromJWK } from "../utils";

/**
 * GoogleOAuth AnonGroupProvider for people in a company (using company domain in Google Workspace account)
 */
export const GoogleOAuthProvider: AnonGroupProvider = {
  //
  name: () => "google-oauth",
  //
  getSlug: () => "domain",
  //
  generateProof: async (ephemeralKey: EphemeralKey) => {
    // Load Google OAuth script
    await loadGoogleOAuthScript();

    // Sign in with Google with ephemeralPubkey (hash) as nonce

    const idToken = await signInWithGoogle({
      nonce: ephemeralKey.ephemeralPubkeyHash.toString(),
    });

    const [headersB64, payloadB64] = idToken.split(".");
    const headers = JSON.parse(atob(headersB64));
    const payload = JSON.parse(atob(payloadB64));

    const domain = payload.hd;
    if (!domain) {
      throw new Error(
        "You can use this app with a Google account that is part of an organization."
      );
    }

    // Get Google pubkey
    const keyId = headers.kid;
    const googleJWTPubkey = await fetchGooglePublicKey(keyId);

    // Generate proof using JWT circuit
    const proof = await JWT_CIRCUIT_HELPER.generateProof({
      idToken,
      jwtPubkey: googleJWTPubkey,
      ephemeralKey: ephemeralKey,
      domain,
    });

    const anonGroup = GoogleOAuthProvider.getAnonGroup(domain);

    const proofArgs = {
      keyId,
    };

    return {
      proof: proof.proof,
      anonGroup,
      proofArgs,
    };
  },
  //
  verifyProof: async (
    proof: Uint8Array,
    anonGroupId: string,
    ephemeralPubkey: bigint,
    ephemeralPubkeyExpiry: Date,
    proofArgs: { keyId: string }
  ) => {
    // Verify the pubkey belongs to Google
    const googlePubkeyJWK = await fetchGooglePublicKey(proofArgs.keyId);
    if (!googlePubkeyJWK) {
      throw new Error(
        "[Google OAuth] Proof verification failed: could not validate Google public key."
      );
    }
    const googleJWTPubkeyModulus = await pubkeyModulusFromJWK(googlePubkeyJWK);

    return await JWT_CIRCUIT_HELPER.verifyProof(proof, {
      domain: anonGroupId,
      jwtPubKey: googleJWTPubkeyModulus,
      ephemeralPubkey: ephemeralPubkey,
      ephemeralPubkeyExpiry: ephemeralPubkeyExpiry,
    });
  },
  //
  getAnonGroup: (anonGroupId: string) => {
    return {
      id: anonGroupId,
      title: anonGroupId,
      logoUrl: `https://img.logo.dev/${anonGroupId}?token=pk_SqdEexoxR3akcyJz7PneXg`,
    };
  },
};

//

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (params: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

async function loadGoogleOAuthScript() {
  return new Promise<void>((resolve) => {
    if (typeof window.google !== "undefined" && window.google.accounts) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();

    document.body.appendChild(script);
  });
}

export async function signInWithGoogle({
  nonce,
}: {
  nonce: string;
}): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Google Client ID is not set");
  }

  try {
    // First, try One Tap sign-in
    return await signInWithGoogleOneTap({ nonce, clientId });
  } catch (error) {
    console.log("One Tap sign-in failed, falling back to popup method", error);
    // If One Tap fails, fall back to popup method
    return signInWithGooglePopup({ nonce, clientId });
  }
}

async function signInWithGooglePopup({
  nonce,
  clientId,
}: {
  nonce: string;
  clientId: string;
}): Promise<string> {
  // Generate a random state
  const state = Math.random().toString(36).substring(2, 15);

  // Store the state and nonce in localStorage
  localStorage.setItem(LocalStorageKeys.GoogleOAuthState, state);
  localStorage.setItem(LocalStorageKeys.GoogleOAuthNonce, nonce);

  // Construct the Google OAuth URL
  const redirectUri = `${window.location.origin}/auth`;
  const scope = "openid email";
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=id_token` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}` +
    `&nonce=${nonce}`;

  // Open the auth window
  const authWindow = window.open(
    authUrl,
    "Google Sign In",
    "width=500,height=600"
  );

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "GOOGLE_SIGN_IN_SUCCESS") {
        const { idToken, state: returnedState } = event.data;

        // Verify the state
        if (
          returnedState !==
          localStorage.getItem(LocalStorageKeys.GoogleOAuthState)
        ) {
          reject(new Error("Invalid state parameter"));
          return;
        }

        // Parse the ID token
        const [, payloadB64] = idToken.split(".");
        const tokenPayload = JSON.parse(atob(payloadB64));

        // Verify the nonce
        if (tokenPayload.nonce !== nonce) {
          reject(new Error("Invalid nonce"));
          return;
        }

        // Clean up
        localStorage.removeItem(LocalStorageKeys.GoogleOAuthState);
        localStorage.removeItem(LocalStorageKeys.GoogleOAuthNonce);
        window.removeEventListener("message", handleMessage);

        resolve(idToken);
      } else if (event.data.type === "GOOGLE_SIGN_IN_ERROR") {
        reject(new Error(event.data.error));
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    // Periodically check if the auth window is still open
    const checkInterval = setInterval(() => {
      if (authWindow && authWindow.closed) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 1000);

    // Set a timeout for the authentication process
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("Authentication timed out"));
    }, 120000); // 2 minutes timeout

    // Clean up the timeout if authentication succeeds
    window.addEventListener(
      "message",
      () => {
        clearTimeout(timeout);
      },
      { once: true }
    );
  });
}

async function signInWithGoogleOneTap({
  nonce,
  clientId,
}: {
  nonce: string;
  clientId: string;
}): Promise<string> {
  await loadGoogleOAuthScript();

  return new Promise((resolve, reject) => {
    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string; error: string }) => {
        if (response.error) {
          reject(response.error);
        } else {
          const idTokenStr = response.credential;
          const [, payloadB64] = idTokenStr.split(".");
          const tokenPayload = JSON.parse(atob(payloadB64));

          if (tokenPayload.nonce !== nonce) {
            reject({ error: "Invalid nonce" });
          } else {
            resolve(idTokenStr);
          }
        }
      },
      nonce: nonce,
      context: "signin",
    });

    // @ts-expect-error its valid to pass this callback
    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject("One Tap not displayed or skipped");
      }
    });
  });
}

export async function fetchGooglePublicKey(keyId: string) {
  if (!keyId) {
    return null;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const keys = await response.json();

  const key = keys.keys.find((key: { kid: string }) => key.kid === keyId);
  if (!key) {
    console.error(`Google public key with id ${keyId} not found`);
    return null;
  }

  return key;
}
