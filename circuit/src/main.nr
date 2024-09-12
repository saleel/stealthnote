use dep::std::hash::sha256;
use dep::std::hash::sha256_var;
use dep::noir_rsa::bignum::BigNum;
use dep::noir_rsa::bignum::runtime_bignum::BigNumInstance;
use dep::noir_rsa::bignum::fields::Params2048;
use dep::noir_rsa::RSA;

type BN2048 = BigNum<18, Params2048>;
type RSA2048 = RSA<BN2048, BigNumInstance<18, Params2048>, 256>;

global MAX_DATA_LENGTH: u32 = 1024;

fn main(
    pubkey_modulus_limbs: [Field; 18],
    redc_params_limbs: [Field; 18],
    data: [u8; MAX_DATA_LENGTH],
    data_length: Field,
    signature_limbs: [Field; 18]
) {
    let pubkey: BigNumInstance<18, Params2048> = BigNumInstance::new(pubkey_modulus_limbs, redc_params_limbs);

    assert(data_length == 917);

    let header_hash: [u8; 32] = sha256_var(data, data_length as u64);

    let signature: BN2048 = BigNum::from_array(signature_limbs);

    // // verify the DKIM signature over the header
    let rsa: RSA2048 = RSA {};
    assert(rsa.verify_sha256_pkcs1v15(pubkey, header_hash, signature));
}

#[test]
fn test_main() {
    
}
