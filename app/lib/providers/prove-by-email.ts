import { EmailCircuitHelper } from "../circuits/email";
import { AnonGroupProvider, EphemeralKey } from "../types";


/**
 * GoogleOAuth AnonGroupProvider for people in a company (using company domain in Google Workspace account)
 */
export const ProveByEmailProvider: AnonGroupProvider = {
  //
  name: () => "email",
  //
  getSlug: () => "domain",
  //
  generateProof: async (ephemeralKey: EphemeralKey, args: { email: string, domain: string, dkimSelector: string }) => {
    const { email, domain } = args;
    if (!email || !domain) {
      throw new Error("[ProveByEmailProvider] Invalid arguments: email and domain are required");
    }

    const proof = await EmailCircuitHelper.generateProof({
      email,
      ephemeralKey: ephemeralKey,
      domain,
    });

    const anonGroup = ProveByEmailProvider.getAnonGroup(domain);

    const proofArgs = {
      dkimSelector: args.dkimSelector,
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
    proofArgs: { dkimSelector: string }
  ) => {
    const dkimPubKey = await fetchDKIMPubkey(anonGroupId, proofArgs.dkimSelector);
    if (!dkimPubKey) {
      throw new Error(
        "[Prove With Email] Proof verification failed: could not fetch DKIM pubkey."
      );
    }

    return await EmailCircuitHelper.verifyProof(proof, {
      domain: anonGroupId,
      dkimPubKey: dkimPubKey,
      ephemeralPubkey: ephemeralPubkey,
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

interface DNSResponse {
  Status: number;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
}

export async function fetchDKIMPubkey(domain: string, selector: string): Promise<bigint> {
  // Use Google HTTP DNS to fetch DKIM pubkey
  const dkimRecordName = `${selector}._domainkey.${domain}`;
  const googleDnsUrl = `https://dns.google/resolve?name=${dkimRecordName}&type=TXT`;
  const googleDnsResponse = await fetch(googleDnsUrl);
  const googleDnsData = await googleDnsResponse.json() as DNSResponse;

  if (!googleDnsData.Answer?.[0]?.data) {
    throw new Error(`No DKIM record found for ${dkimRecordName}`);
  }

  // DKIM record is in format: "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A..."
  const dkimRecord = googleDnsData.Answer[0].data;
  const dkimParts = dkimRecord.split(';').map((part: string) => part.trim());

  // Find the p= part which contains the base64 encoded public key
  const publicKeyPart = dkimParts.find((part: string) => part.startsWith('p='));
  if (!publicKeyPart) {
    throw new Error('No public key found in DKIM record');
  }

  // Extract the base64 public key
  const base64PubKey = publicKeyPart.substring(2);

  const binaryDerString = atob(base64PubKey);
  const binaryDer = new Uint8Array([...binaryDerString].map(c => c.charCodeAt(0)));

  // Use WebCrypto to import the key
  const key = await globalThis.crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    {
      name: 'RSA-PSS',
      hash: 'SHA-256'
    },
    true,
    ['verify']
  );

  // Export the key as jwk to access the modulus
  const jwk = await globalThis.crypto.subtle.exportKey('jwk', key);

  // Decode base64url modulus to BigInt
  const modulusB64Url = jwk.n;
  const modulusBin = Uint8Array.from(atob(modulusB64Url!.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

  // Convert binary modulus to BigInt
  const hex = [...modulusBin].map(b => b.toString(16).padStart(2, '0')).join('');
  const modulusBigInt = BigInt('0x' + hex);


  return modulusBigInt;
}
