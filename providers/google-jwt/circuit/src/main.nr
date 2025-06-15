use jwt::JWT;
use std::hash::poseidon2::Poseidon2;

global MAX_PARTIAL_DATA_LENGTH: u32 = 640; // signed data length after partial SHA
global MAX_DOMAIN_LENGTH: u32 = 64;
global MAX_EMAIL_LENGTH: u32 = 128;
global NONCE_LENGTH: u32 = 77;

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
 * @param jwt_pubkey_modulus_limbs: RSA public key modulus limbs (2048-bit split into 18 limbs)
 * @param jwt_pubkey_redc_params_limbs: RSA reduction parameters limbs
 * @param jwt_signature_limbs: RSA signature limbs
 * @param domain: Domain name (`hd` key) as a byte array of ascii characters padded to MAX_DOMAIN_LENGTH
 * @param ephemeral_pubkey: Public key of the ephemeral keypair that is used to sign messages
 * @param ephemeral_pubkey_salt: Salt of the ephemeral keypair that is used to sign messages
 * @param ephemeral_pubkey_expiry: Expiry of the ephemeral keypair that is used to sign messages
 * @param nonce: JWT `nonce` as a byte array of ascii characters - 32 bytes
 **/
fn main(
    partial_data: BoundedVec<u8, MAX_PARTIAL_DATA_LENGTH>,
    partial_hash: [u32; 8],
    full_data_length: u32,
    base64_decode_offset: u32,
    jwt_pubkey_modulus_limbs: pub [u128; 18],
    jwt_pubkey_redc_params_limbs: [u128; 18],
    jwt_signature_limbs: [u128; 18],
    domain: pub BoundedVec<u8, MAX_DOMAIN_LENGTH>,
    ephemeral_pubkey: pub Field,
    ephemeral_pubkey_salt: Field,
    ephemeral_pubkey_expiry: pub u32,
) {
    // Init JWT struct and verify signature
    let jwt = JWT::init_with_partial_hash(
        partial_data,
        partial_hash,
        full_data_length,
        base64_decode_offset,
        jwt_pubkey_modulus_limbs,
        jwt_pubkey_redc_params_limbs,
        jwt_signature_limbs,
    );
    jwt.verify();

    // Get nonce claim
    let nonce: BoundedVec<u8, NONCE_LENGTH> = jwt.get_claim_string("nonce".as_bytes());
    let nonce_field: Field = decimal_string_to_field(nonce.storage());

    // Verify nonce is the hash(ephemeral_pubkey, ephemeral_pubkey_salt, ephemeral_pubkey_expiry)
    let ephemeral_pubkey_hash = Poseidon2::hash(
        [ephemeral_pubkey, ephemeral_pubkey_salt, ephemeral_pubkey_expiry as Field],
        3,
    );

    assert(nonce_field == ephemeral_pubkey_hash, "invalid nonce");

    // Assert email_verified claim
    jwt.assert_claim_bool("email_verified".as_bytes(), true);

    // Get email claim
    let email: BoundedVec<u8, MAX_EMAIL_LENGTH> = jwt.get_claim_string("email".as_bytes());

    // Get domain start_index from email claim - unconstrained, but we verify the domain bytes below
    let domain_start_index = unsafe { get_domain_start_index_in_email(email) };

    // Verify domain passed is present in the email claim after the @
    assert(email.storage()[domain_start_index - 1] == 64, "char before domain is not '@'");
    for i in 0..MAX_DOMAIN_LENGTH {
        assert(email.storage()[domain_start_index + i] == domain.storage()[i], "invalid domain");
    }
}

fn decimal_string_to_field<let LEN: u32>(decimal_bytes: [u8; LEN]) -> Field {
    assert(LEN <= 77);

    let mut field: Field = 0;
    let mut multiplier: Field = 1;

    for i in 0..LEN {
        let ascii_char = decimal_bytes[LEN - i - 1];
        if ascii_char >= 48 & ascii_char <= 57 {
            let digit = ascii_char as Field - 48;
            field += digit * multiplier;
            multiplier *= 10;
        }
    }

    field
}

unconstrained fn get_domain_start_index_in_email(email: BoundedVec<u8, MAX_EMAIL_LENGTH>) -> u32 {
    let mut domain_start_index = 0;
    for i in 0..MAX_EMAIL_LENGTH {
        if email.storage()[i] == ("@".as_bytes())[0] {
            domain_start_index = i + 1;
            break;
        }
    }

    domain_start_index
}
