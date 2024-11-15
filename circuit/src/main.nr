use dep::jwt::JWT;

global MAX_PARTIAL_DATA_LENGTH: u32 = 640; // Data after partial SHA
global MAX_DOMAIN_LENGTH: u32 = 50;
global NONCE_LENGTH: u32 = 32;

/**
 * @brief Verify JWT signature (RSA/SHA256 only) and validate hd and nonce fields
 *
 * @param partial_data: OIDC JWT (id_token) base64 data (`$header.$payload`) as byte array of ascii characters
 *                      We do partial SHA on the data up to hd field outside of the circuit, to reduce constraints
 *                      This field only contains the bytes after partial SHA; padded to MAX_PARTIAL_DATA_LENGTH
 * @param partial_hash: The 256-bit partial hash of the `data`
 * @param full_data_length: The full length of the `data` (before partial SHA)
 * @param b64_offset: Offset needed in `partial_data` to make the payloadB64 a multiple of 4
 *                    Signed data is $header.$payload. $payload might not be a multiple of 4 in `partial_data`, so we need to offset
 *                    Not attack-able by giving an incorrect offset, as string match of hd and nonce will fail
 * @param pubkey_modulus_limbs: RSA public key modulus limbs (2048-bit split into 18 limbs)
 * @param redc_params_limbs: RSA reduction parameters limbs
 * @param signature_limbs: RSA signature limbs
 * @param domain: Domain name (`hd` key) as a byte array of ascii characters padded to MAX_DOMAIN_LENGTH
 * @param nonce: JWT `nonce` as a byte array of ascii characters - 32 bytes
 **/
fn main(
    partial_data: BoundedVec<u8, MAX_PARTIAL_DATA_LENGTH>,
    partial_hash: [u32; 8],
    full_data_length: u32,
    b64_offset: u32,
    pubkey_modulus_limbs: pub [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18],
    domain: pub BoundedVec<u8, MAX_DOMAIN_LENGTH>,
    nonce: pub BoundedVec<u8, NONCE_LENGTH>,
) {
    let jwt = JWT::init_with_partial_hash(
        partial_data,
        partial_hash,
        full_data_length,
        b64_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs,
    );

    jwt.verify();
    jwt.validate_key_value::<300, 2, MAX_DOMAIN_LENGTH>("hd".as_bytes(), domain); // Domain is under the hd key for Google Workspace tokens
    jwt.validate_key_value::<300, 5, 32>("nonce".as_bytes(), nonce);

    // TODO: 
    // validate exp - is there a chance the token is expired? Do we care?
    // validate aud - is there a chance the token was generated for a different app?
    // validate is_email_verified? - can users create accounts without verifying their email?
}
