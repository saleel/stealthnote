import { JWT_CIRCUIT_HELPER } from "../circuits/jwt-0.3.0";
import { AnonGroupProvider, EphemeralKey, LocalStorageKeys } from "../types";
import { pubkeyModulusFromJWK } from "../utils";

/**
 * MicrosoftOAuth AnonGroupProvider for people in a company (using company domain in Microsoft account)
 */
export const MicrosoftOAuthProvider: AnonGroupProvider = {
  name: () => "microsoft-oauth",
  
  getSlug: () => "domain",
  
  generateProof: async (ephemeralKey: EphemeralKey) => {
    // Load Microsoft MSAL script
    await loadMicrosoftOAuthScript();

    // Sign in with Microsoft with ephemeralPubkey (hash) as nonce
    const idToken = await signInWithMicrosoft({
      nonce: ephemeralKey.ephemeralPubkeyHash.toString(),
    });

    const [headersB64, payloadB64] = idToken.split(".");
    const headers = JSON.parse(atob(headersB64));
    const payload = JSON.parse(atob(payloadB64));

    const domain = payload.tid; // tenant ID for Microsoft
    if (!domain) {
      throw new Error(
        "You can use this app with a Microsoft account that is part of an organization."
      );
    }

    // Get Microsoft pubkey
    const keyId = headers.kid;
    const microsoftJWTPubkey = await fetchMicrosoftPublicKey(keyId);

    // Generate proof using JWT circuit
    const proof = await JWT_CIRCUIT_HELPER.generateProof({
      idToken,
      jwtPubkey: microsoftJWTPubkey,
      ephemeralKey: ephemeralKey,
      domain,
    });

    const anonGroup = MicrosoftOAuthProvider.getAnonGroup(domain);

    const proofArgs = {
      keyId,
    };

    return {
      proof: proof.proof,
      anonGroup,
      proofArgs,
    };
  },

  verifyProof: async (
    proof: Uint8Array,
    anonGroupId: string,
    ephemeralPubkey: bigint,
    ephemeralPubkeyExpiry: Date,
    proofArgs: { keyId: string }
  ) => {
    // Verify the pubkey belongs to Microsoft
    const microsoftPubkeyJWK = await fetchMicrosoftPublicKey(proofArgs.keyId);
    if (!microsoftPubkeyJWK) {
      throw new Error(
        "[Microsoft OAuth] Proof verification failed: could not validate Microsoft public key."
      );
    }
    const microsoftJWTPubkeyModulus = await pubkeyModulusFromJWK(microsoftPubkeyJWK);

    return await JWT_CIRCUIT_HELPER.verifyProof(proof, {
      domain: anonGroupId,
      jwtPubKey: microsoftJWTPubkeyModulus,
      ephemeralPubkey: ephemeralPubkey,
      ephemeralPubkeyExpiry: ephemeralPubkeyExpiry,
    });
  },

  getAnonGroup: (anonGroupId: string) => {
    return {
      id: anonGroupId,
      title: anonGroupId,
      logoUrl: `https://img.logo.dev/${anonGroupId}?token=pk_SqdEexoxR3akcyJz7PneXg`,
    };
  },
};

declare global {
  interface Window {
    msal?: any;
  }
}

async function loadMicrosoftOAuthScript() {
  return new Promise<void>((resolve) => {
    if (typeof window.msal !== "undefined") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://alcdn.msauth.net/browser/2.30.0/js/msal-browser.min.js";
    script.onload = () => resolve();

    document.body.appendChild(script);
  });
}

export async function signInWithMicrosoft({
  nonce,
}: {
  nonce: string;
}): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error("Microsoft Client ID is not set");
  }

  const msalConfig = {
    auth: {
      clientId: clientId,
      authority: "https://login.microsoftonline.com/common",
      redirectUri: window.location.origin + "/auth",
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  };

  const msalInstance = new window.msal.PublicClientApplication(msalConfig);

  const loginRequest = {
    scopes: ["openid", "profile", "email"],
    prompt: "select_account",
    nonce: nonce,
  };

  try {
    const response = await msalInstance.loginPopup(loginRequest);
    return response.idToken;
  } catch (error) {
    console.error("Error during Microsoft sign-in:", error);
    throw error;
  }
}

export async function fetchMicrosoftPublicKey(keyId: string) {
  if (!keyId) {
    return null;
  }

  const response = await fetch("https://login.microsoftonline.com/common/discovery/v2.0/keys");
  const keys = await response.json();

  const key = keys.keys.find((key: { kid: string }) => key.kid === keyId);
  if (!key) {
    console.error(`Microsoft public key with id ${keyId} not found`);
    return null;
  }

  return key;
} 