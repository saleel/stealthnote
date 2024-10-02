// mod utils;

use dep::std::hash::sha256_var;
use dep::noir_rsa::bignum::BigNum;
use dep::noir_rsa::bignum::runtime_bignum::BigNumInstance;
use dep::noir_rsa::bignum::fields::Params2048;
use dep::noir_rsa::types::RSA;
use dep::string_search::{SubString, StringBody, SubString32, SubString64, StringBody256};
use dep::noir_base64::{base64_encode};


global MAX_DATA_LENGTH: u32 = 1024;
global MAX_DOMAIN_LENGTH: u32 = 50;
global NONCE_LENGTH: u32 = 32;
global B64_SKIP_CHARS: u32 = 300;
global B64_DECODE_LENGTH: u32 = 200;
global ENCODED_PAYLOAD_LENGTH: u32 = B64_DECODE_LENGTH * 3 / 4;

type BN2048 = BigNum<18, Params2048>;
type RSA2048 = RSA<BN2048, BigNumInstance<18, Params2048>, 256>;


// TODO:
// - Partial SHA can skip first few blocks
// - Pack public inputs in to fewer fields, hash pubkey modulus
// - Make body length dynamic
// - Add more tests
// - Not necessary, but add a nullifier


/**
 * @brief Verify JWT signature (RSA/SHA256 only) and validate hd and nonce fields
 *
 *
 * @param data: OIDC JWT (id_token) base64 data (`$header.$payload`) as byte array of ascii characters, padded to MAX_DATA_LENGTH
 * @param data_length: The actual length of the `data`
 * @param pubkey_modulus_limbs: RSA public key modulus limbs (2048-bit split into 18 limbs)
 * @param redc_params_limbs: RSA reduction parameters limbs
 * @param signature_limbs: RSA signature limbs
 * @param domain_name: Domain name (`hd` key) as a byte array of ascii characters padded to MAX_DOMAIN_LENGTH
 * @param domain_name_length: The actual length of the `domain_name`
 * @param nonce: JWT `nonce` as a byte array of ascii characters - 32 bytes
 **/
fn main(
    data: [u8; MAX_DATA_LENGTH],
    data_length: u32,
    pubkey_modulus_limbs: pub [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18],
    domain_name: pub [u8; 50],
    domain_name_length: u32,
    nonce: pub [u8; 32],
) {
    // Hash the data using SHA256
    let data_hash: [u8; 32] = sha256_var(data, data_length as u64);

    // Verify RSA signature
    let rsa: RSA2048 = RSA {};
    let pubkey: BigNumInstance<18, Params2048> = BigNumInstance::new(pubkey_modulus_limbs, redc_params_limbs);
    let signature: BN2048 = BigNum::from_array(signature_limbs);
    assert(rsa.verify_sha256_pkcs1v15(pubkey, data_hash, signature, 65537));

    // Assert the value before $payload is a '.' (JWT structure => `$header.$payload.$signature`)
    // `payload_start_index` is hardcoded for Google as header length is always 102
    // TODO: Make this dynamic based to be more generic
    let payload_start_index = 103;  
    assert(data[payload_start_index - 1] == 46);

    // Decode the base64 payload
    // Base64 decoding is expensive, so we only decode some portion of the payload
    // The data we want to check (hd, nonce) is in between 225th and 425th characters of decoded payload
    // So we decode only 300th to 500th base64 encoded characters, as 4 base64 chars = 3 bytes (3 ascii chars)
    // Since base64 encoding happen in 4 byte chunks, we can skip multiple of 4 characters
    // We decode 200 base64 encoded characters and get 150 ascii characters
    let mut payload_b64: [u8; B64_DECODE_LENGTH] = [0; B64_DECODE_LENGTH];
    for i in 0..B64_DECODE_LENGTH {
        payload_b64[i] = data[payload_start_index + B64_SKIP_CHARS + i];
    }
    let payload: [u8; ENCODED_PAYLOAD_LENGTH] = base64_encode(payload_b64);

    validate_hd_field(payload, domain_name, domain_name_length);
    validate_nonce(payload, nonce);
}

// Validate the hd field in the payload is same as domain_name
fn validate_hd_field(payload: [u8; ENCODED_PAYLOAD_LENGTH], domain_name: [u8; 50], domain_name_length: u32) {
    let hd_prefix = "\"hd\":\"".as_bytes();
    let hd_prefix_substring: SubString32 = SubString::new(hd_prefix, hd_prefix.len());
    let domain_substring: SubString64 = SubString::new(domain_name, domain_name_length);
    let domain_needle = hd_prefix_substring.concat_into(domain_substring);

    let haystack: StringBody256 = StringBody::new(payload, payload.len());
    let (domain_found, domain_position): (bool, u32) = haystack.substring_match(domain_needle);
    
    assert(domain_found);

    // Assert the value after hd value is a `"` - to prevent partial match attacks
    assert(payload[domain_position + domain_needle.len()] == 34);
}

// Validate the nonce field in the payload is same as nonce passed
fn validate_nonce(payload: [u8; ENCODED_PAYLOAD_LENGTH], nonce: [u8; NONCE_LENGTH]) {
    let nonce_prefix = "\"nonce\":\"".as_bytes();
    let nonce_prefix_substring: SubString32 = SubString::new(nonce_prefix, nonce_prefix.len());
    let nonce_substring: SubString64 = SubString::new(nonce, 32);
    let nonce_needle = nonce_prefix_substring.concat_into(nonce_substring);

    let haystack: StringBody256 = StringBody::new(payload, payload.len());
    let (nonce_found, nonce_position): (bool, u32) = haystack.substring_match(nonce_needle);
    
    assert(nonce_found);
    assert(payload[nonce_position + nonce_needle.len()] == 34);
}
