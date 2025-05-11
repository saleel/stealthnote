import { JWTCircuitHelper  } from "../circuits/jwt";
import { AnonGroupProvider, EphemeralKey } from "../types";
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
  generateProof: async (ephemeralKey: EphemeralKey, { idToken }: { idToken: string }) => {
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
    const proof = await JWTCircuitHelper.generateProof({
      idToken,
      jwtPubkey: googleJWTPubkey,
      ephemeralKey: ephemeralKey,
      domain,
    });

    const anonGroup = GoogleOAuthProvider.getAnonGroup(domain);

    const proofArgs = {
      keyId,
      jwtCircuitVersion: JWTCircuitHelper.version,
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
    proofArgs: { keyId: string, jwtCircuitVersion: string }
  ) => {
    if (proofArgs.jwtCircuitVersion !== JWTCircuitHelper.version) {
      throw new Error(
        'This proof was generated with an older version of StealthNote JWT circuit and ' +
        'cannot be verified at this time. You can run an older version of the app to verify this proof.'
      );
    }

    // Verify the pubkey belongs to Google
    const googlePubkeyJWK = await fetchGooglePublicKey(proofArgs.keyId);
    if (!googlePubkeyJWK) {
      throw new Error(
        "[Google OAuth] Proof verification failed: could not validate Google public key."
      );
    }
    const googleJWTPubkeyModulus = await pubkeyModulusFromJWK(googlePubkeyJWK);

    return await JWTCircuitHelper.verifyProof(proof, {
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
