use dep::std::hash::sha256_var;
use dep::noir_rsa::bignum::BigNum;
use dep::noir_rsa::bignum::runtime_bignum::BigNumInstance;
use dep::noir_rsa::bignum::fields::Params2048;
use dep::noir_rsa::types::RSA;
use dep::string_search::{SubString, StringBody, SubString32, SubString64, StringBody256};
use dep::noir_base64::{base64_decode};
use dep::zkemail::{partial_hash::partial_sha256_var_end};

global MAX_PARTIAL_DATA_LENGTH: u32 = 640; // Data after partial SHA
global MAX_DOMAIN_LENGTH: u32 = 50;
global NONCE_LENGTH: u32 = 32;
global B64_DECODE_LENGTH: u32 = 240; // Length of b64 data to be coded (we only need hd and nonce)
global ENCODED_PAYLOAD_LENGTH: u32 = B64_DECODE_LENGTH * 3 / 4;

type BN2048 = BigNum<18, Params2048>;
type RSA2048 = RSA<BN2048, BigNumInstance<18, Params2048>, 256>;


// TODO:
// - Do we need to check email_verified: true?
// - Not necessary, but add a nullifier


/**
 * @brief Verify JWT signature (RSA/SHA256 only) and validate hd and nonce fields
 *
 *
 * @param partial_data: OIDC JWT (id_token) base64 data (`$header.$payload`) as byte array of ascii characters
 *                      We do partial SHA on the data up to "hd" field outside of the circuit, to reduce constraints
 *                      This field only contains the bytes after partial SHA; padded to MAX_PARTIAL_DATA_LENGTH
 * @param partial_data_length: The actual length of the `partial_data`
 * @param partial_hash: The 256-bit partial hash of the `data`
 * @param data_length: The full length of the `data` (before partial SHA)
 * @param b64_offset: Offset needed in `partial_data` to make the payloadB64 a multiple of 4
 *                    Signed data is "$header.$payload". $payload might not be a multiple of 4 in `partial_data`, so we need to offset
 *                    Not attack-able by giving an incorrect offset, as string match of "hd" and "nonce" will fail
 * @param pubkey_modulus_limbs: RSA public key modulus limbs (2048-bit split into 18 limbs)
 * @param redc_params_limbs: RSA reduction parameters limbs
 * @param signature_limbs: RSA signature limbs
 * @param domain_name: Domain name (`hd` key) as a byte array of ascii characters padded to MAX_DOMAIN_LENGTH
 * @param domain_name_length: The actual length of the `domain_name`
 * @param nonce: JWT `nonce` as a byte array of ascii characters - 32 bytes
 **/
fn main(
    partial_data: [u8; MAX_PARTIAL_DATA_LENGTH],
    partial_data_length: u32,
    partial_hash: [u32; 8],
    data_length: u32,
    b64_offset: u32,
    pubkey_modulus_limbs: pub [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18],
    domain_name: pub [u8; MAX_DOMAIN_LENGTH],
    domain_name_length: u32,
    nonce: pub [u8; 32],
) {
    assert(partial_data_length < MAX_PARTIAL_DATA_LENGTH, "partial_data_length is too long");
    assert(domain_name_length < MAX_DOMAIN_LENGTH, "domain_name_length is too long");

    // Hash the data using SHA256
    let data_hash = partial_sha256_var_end(partial_hash, partial_data, partial_data_length as u64, data_length as u64);    

    // Verify RSA signature
    let rsa: RSA2048 = RSA {};
    let pubkey: BigNumInstance<18, Params2048> = BigNumInstance::new(pubkey_modulus_limbs, redc_params_limbs);
    let signature: BN2048 = BigNum::from_array(signature_limbs);
    assert(rsa.verify_sha256_pkcs1v15(pubkey, data_hash, signature, 65537), "RSA signature verification failed");

    // Decode the base64 payload
    let mut payload_b64: [u8; B64_DECODE_LENGTH] = [0; B64_DECODE_LENGTH];
    for i in 0..B64_DECODE_LENGTH {
        payload_b64[i] = partial_data[i + b64_offset];
    }
    let payload: [u8; ENCODED_PAYLOAD_LENGTH] = base64_decode(payload_b64);

    validate_domain_and_nonce(payload, domain_name, domain_name_length, nonce);
}

// Validate the hd (domain) field in the payload is same as domain_name
fn validate_domain_and_nonce(payload: [u8; ENCODED_PAYLOAD_LENGTH], domain_name: [u8; 50], domain_name_length: u32, nonce: [u8; 32]) {
    let haystack: StringBody256 = StringBody::new(payload, payload.len());

    let hd_prefix = "\"hd\":\"".as_bytes();
    let hd_prefix_substring: SubString32 = SubString::new(hd_prefix, hd_prefix.len());
    let domain_substring: SubString64 = SubString::new(domain_name, domain_name_length);
    let domain_needle = hd_prefix_substring.concat_into(domain_substring);

    let (domain_found, domain_position): (bool, u32) = haystack.substring_match(domain_needle);
    assert(domain_found, "domain not found");
    // Assert the value after hd value is a `"` - to prevent partial match attacks
    assert(payload[domain_position + domain_needle.len()] == 34, "incorrect domain");

    let nonce_prefix = "\"nonce\":\"".as_bytes();
    let nonce_prefix_substring: SubString32 = SubString::new(nonce_prefix, nonce_prefix.len());
    let nonce_substring: SubString64 = SubString::new(nonce, 32);
    let nonce_needle = nonce_prefix_substring.concat_into(nonce_substring);

    let (nonce_found, nonce_position): (bool, u32) = haystack.substring_match(nonce_needle);
    assert(nonce_found, "nonce not found");
    assert(payload[nonce_position + nonce_needle.len()] == 34, "incorrect nonce");
}
