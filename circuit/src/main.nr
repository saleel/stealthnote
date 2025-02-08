use dep::jwt::JWT;

global MAX_PARTIAL_DATA_LENGTH: u32 = 640; // Data after partial SHA
global MAX_DOMAIN_LENGTH: u32 = 50;
global MAX_EMAIL_LENGTH: u32 = 100;
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
    base64_decode_offset: u32,
    pubkey_modulus_limbs: pub [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18],
) -> pub (BoundedVec<u8, MAX_DOMAIN_LENGTH>, BoundedVec<u8, NONCE_LENGTH>) {
    let jwt = JWT::init_with_partial_hash(
        partial_data,
        partial_hash,
        full_data_length,
        base64_decode_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs,
    );

    jwt.verify();

    // Assert email_verified claims
    jwt.assert_claim_bool::<300, 14>("email_verified".as_bytes(), true);

    // Get nonce claim
    let nonce: BoundedVec<u8, NONCE_LENGTH> =
        jwt.get_claim_string::<300, 5, NONCE_LENGTH>("nonce".as_bytes());

    // Get email claim
    let email = jwt.get_claim_string::<420, 5, MAX_EMAIL_LENGTH>("email".as_bytes());

    // Get domain from email claim - extract domain unconstrained and constrain afterwards
    let (domain, domain_start_index) = unsafe { get_domain_from_email(email) };

    assert(email.storage()[domain_start_index - 1] == 64, "char before domain is not@");
    for i in 0..MAX_DOMAIN_LENGTH {
        assert(email.storage()[domain_start_index + i] == domain.storage()[i], "invalid domain");
    }

    (domain, nonce)
}

unconstrained fn get_domain_from_email(
    email: BoundedVec<u8, MAX_EMAIL_LENGTH>,
) -> (BoundedVec<u8, MAX_DOMAIN_LENGTH>, u32) {
    let mut domain_start_index = 0;
    for i in 0..MAX_EMAIL_LENGTH {
        if email.storage()[i] == ("@".as_bytes())[0] {
            domain_start_index = i + 1;
            break;
        }
    }

    let mut domain = BoundedVec::new();
    for i in 0..MAX_DOMAIN_LENGTH {
        let c = email.storage()[domain_start_index + i];
        if c == 0 {
            break;
        }
        domain.push(c);
    }

    (domain, domain_start_index)
}
