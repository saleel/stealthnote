import { JWT_CIRCUIT_HELPER } from "../circuits/jwt-0.2.0";
import { AnonGroupProvider } from "../types";
import { pubkeyModulusFromJWK } from "../utils";

/**
 * SlackOAuth AnonGroupProvider for people in a Slack workspace
 */
export const SlackOAuthProvider: AnonGroupProvider = {
  name: () => "slack-oauth",

  getSlug: () => "domain",

  generateProof: async (ephemeralPubkey: string) => {
    // Hash the ephemeral pubkey for the nonce
    const nonce = await hashPublicKey(ephemeralPubkey);

    // Get ID token from Slack OAuth flow
    const idToken = await getSlackIdToken(nonce);
    console.log("idToken", idToken);

    // Parse the token to get workspace info and key ID
    const tokenParts = idToken.split(".");
    const header = JSON.parse(atob(tokenParts[0]));
    const payload = JSON.parse(atob(tokenParts[1]));

    console.log("payload", payload);
    console.log("header", header);

    // Get workspace domain from token
    const workspaceDomain = payload.email;

    // Verify the Slack public key
    const slackPubkeyJWK = await fetchSlackPublicKey(header.kid);
    if (!slackPubkeyJWK) {
      throw new Error("Failed to fetch Slack public key");
    }

    // Get modulus for the circuit
    const slackJWTPubkeyModulus = await pubkeyModulusFromJWK(slackPubkeyJWK);

    // Generate proof using JWT circuit
    const proof = await JWT_CIRCUIT_HELPER.generateProof({
      idToken: idToken,
      jwtPubkey: slackJWTPubkeyModulus,
    });

    return {
      proof: proof.proof,
      anonGroup: workspaceDomain,
      proofArgs: { keyId: header.kid },
    };
  },

  verifyProof: async (
    proof: Uint8Array,
    ephemeralPubkey: string,
    anonGroupId: string,
    proofArgs: { keyId: string }
  ) => {
    // Verify the pubkey belongs to Slack
    const slackPubkeyJWK = await fetchSlackPublicKey(proofArgs.keyId);
    if (!slackPubkeyJWK) {
      throw new Error(
        "[Slack OAuth] Proof verification failed: could not validate Slack public key."
      );
    }
    const slackJWTPubkeyModulus = await pubkeyModulusFromJWK(slackPubkeyJWK);

    // Hash the ephemeral pubkey for the nonce
    const ephemeralPubkeyHash = await hashPublicKey(ephemeralPubkey);

    return await JWT_CIRCUIT_HELPER.verifyProof(proof, {
      domain: anonGroupId, // workspace name/id
      nonce: ephemeralPubkeyHash,
      jwtPubKey: slackJWTPubkeyModulus,
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

async function getSlackIdToken(nonce: string): Promise<string> {
  const SLACK_CLIENT_ID =
    process.env.NEXT_PUBLIC_SLACK_CLIENT_ID || "295069689904.7901115482438";
  const SLACK_REDIRECT_URI = `${
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  }/slack/callback`;
  const SLACK_SCOPE = "openid email";

  // Generate state for security
  const state = crypto.randomUUID();
  sessionStorage.setItem("slack_auth_state", state);

  // Construct authorization URL
  const authUrl = new URL("https://slack.com/openid/connect/authorize");
  authUrl.searchParams.append("client_id", SLACK_CLIENT_ID!);
  authUrl.searchParams.append("redirect_uri", SLACK_REDIRECT_URI);
  authUrl.searchParams.append("scope", SLACK_SCOPE);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("nonce", nonce); // Required for OpenID Connect

  // Redirect to Slack authorization page
  const authWindow = window.open(
    authUrl,
    "Slack Sign In",
    "width=500,height=600"
  );

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "SLACK_SIGN_IN_SUCCESS") {
        const { idToken } = event.data;

        // Parse the ID token
        const [, payloadB64] = idToken.split(".");
        const tokenPayload = JSON.parse(atob(payloadB64));

        // Verify the nonce
        if (tokenPayload.nonce !== nonce) {
          reject(new Error("Invalid nonce"));
          return;
        }

        // Clean up
        sessionStorage.removeItem("slack_auth_state");
        window.removeEventListener("message", handleMessage);

        resolve(idToken);
      } else if (event.data.type === "SLACK_SIGN_IN_ERROR") {
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

async function fetchSlackPublicKey(keyId: string) {
  if (!keyId) {
    return null;
  }

  // Slack's JWKS endpoint
  const response = await fetch("https://corsproxy.io/?url=https://slack.com/openid/connect/keys");
  const keys = await response.json();

  const key = keys.keys.find((key: { kid: string }) => key.kid === keyId);
  if (!key) {
    console.error(`Slack public key with id ${keyId} not found`);
    return null;
  }

  return key;
}

async function hashPublicKey(key: string) {
  const messageHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );

  return Array.from(new Uint8Array(messageHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32); // Only using 32 bytes for the nonce
}
