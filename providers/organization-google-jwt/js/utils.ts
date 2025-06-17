export function splitBigIntToLimbs(value: bigint, limbSize: number, numLimbs: number): bigint[] {
  const limbs: bigint[] = [];
  const mask = (1n << BigInt(limbSize)) - 1n;

  for (let i = 0; i < numLimbs; i++) {
    limbs.push(value & mask);
    value = value >> BigInt(limbSize);
  }

  return limbs;
}

export async function pubkeyModulusFromJWK(jwk: JsonWebKey) {
  // Parse pubkeyJWK
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    true,
    ['verify'],
  );

  const publicKeyJWK = await crypto.subtle.exportKey('jwk', publicKey);
  const modulusBigInt = BigInt('0x' + Buffer.from(publicKeyJWK.n as string, 'base64').toString('hex'));

  return modulusBigInt;
}

export async function fetchGooglePublicKey(keyId: string) {
  if (!keyId) {
    return null;
  }

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  const keys = await response.json();

  const key = keys.keys.find((key: { kid: string }) => key.kid === keyId);
  if (!key) {
    console.error(`Google public key with id ${keyId} not found`);
    return null;
  }

  return key;
}
