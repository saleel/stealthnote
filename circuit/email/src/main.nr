use std::{collections::bounded_vec::BoundedVec, hash::{pedersen_hash, poseidon2::Poseidon2}};
use zkemail::{
    dkim::RSAPubkey,
    headers::{constrain_header_field, email_address::get_email_address},
    KEY_LIMBS_2048,
    MAX_EMAIL_ADDRESS_LENGTH,
    Sequence,
};

global MAX_EMAIL_HEADER_LENGTH: u32 = 512;
global MAX_DOMAIN_LENGTH: u32 = 64;
global NONCE_LENGTH: u32 = 77;
global MAX_EMAIL_LENGTH: u32 = 320;

fn main(
    email_header: BoundedVec<u8, MAX_EMAIL_HEADER_LENGTH>,
    dkim_pubkey: RSAPubkey<KEY_LIMBS_2048>,
    dkim_signature: [Field; KEY_LIMBS_2048],
    from_header_sequence: Sequence,
    from_address_sequence: Sequence,
    subject_header_sequence: Sequence,
    domain: pub BoundedVec<u8, MAX_DOMAIN_LENGTH>,
    ephemeral_pubkey: pub Field,
    ephemeral_pubkey_salt: Field,
    ephemeral_pubkey_expiry: pub u32,
) {
    assert(email_header.len() <= MAX_EMAIL_HEADER_LENGTH);

    dkim_pubkey.verify_dkim_signature(email_header, dkim_signature);

    constrain_header_field::<MAX_EMAIL_HEADER_LENGTH, 77, 7>(email_header, subject_header_sequence, "subject".as_bytes());
    let subject = get_subject(email_header, subject_header_sequence);
    let commitment: Field = decimal_string_to_field(subject.storage());

    // Verify nonce is the hash(ephemeral_pubkey, ephemeral_pubkey_salt, ephemeral_pubkey_expiry)
    let ephemeral_pubkey_hash = Poseidon2::hash(
        [ephemeral_pubkey, ephemeral_pubkey_salt, ephemeral_pubkey_expiry as Field],
        3,
    );

    println(subject.storage);

    assert(commitment == ephemeral_pubkey_hash, "invalid commitment");

    let from_address = get_email_address(
        email_header,
        from_header_sequence,
        from_address_sequence,
        "from".as_bytes(),
    );

    // Get domain start_index from email claim - unconstrained, but we verify the domain bytes below
    let domain_start_index = unsafe { get_domain_start_index_in_email(from_address) };

    // Verify domain passed is present in the email claim after the @
    assert(from_address.storage()[domain_start_index - 1] == 64, "char before domain is not '@'");
    for i in 0..MAX_DOMAIN_LENGTH {
        assert(
            from_address.storage()[domain_start_index + i] == domain.storage()[i],
            "invalid domain",
        );
    }
}

fn get_subject(
    header: BoundedVec<u8, MAX_EMAIL_HEADER_LENGTH>,
    subject_sequence: Sequence,
) -> BoundedVec<u8, 77> {
    // check the email address and assign
    let mut subject: BoundedVec<u8, 77> = BoundedVec::new();
    for i in 0..77 {
        let index = subject_sequence.index + i;
        if index < subject_sequence.end_index() {
            let letter = header.get_unchecked(index);
            subject.set_unchecked(i, letter);
        }
    }
    subject.len = subject_sequence.length;
    subject
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

#[test]
fn test_get_domain_start_index_in_email() {
    let header = BoundedVec::from([
        102, 114, 111, 109, 58, 114, 117, 110, 110, 105, 101, 114, 46, 108, 101, 97, 103, 117, 101,
        115, 46, 48, 106, 64, 105, 99, 108, 111, 117, 100, 46, 99, 111, 109, 13, 10, 99, 111, 110,
        116, 101, 110, 116, 45, 116, 121, 112, 101, 58, 116, 101, 120, 116, 47, 112, 108, 97, 105,
        110, 59, 32, 99, 104, 97, 114, 115, 101, 116, 61, 117, 116, 102, 45, 56, 13, 10, 109, 105,
        109, 101, 45, 118, 101, 114, 115, 105, 111, 110, 58, 49, 46, 48, 32, 40, 77, 97, 99, 32, 79,
        83, 32, 88, 32, 77, 97, 105, 108, 32, 49, 54, 46, 48, 32, 92, 40, 51, 55, 51, 49, 46, 53,
        48, 48, 46, 50, 51, 49, 92, 41, 41, 13, 10, 115, 117, 98, 106, 101, 99, 116, 58, 66, 105,
        116, 99, 111, 105, 110, 13, 10, 109, 101, 115, 115, 97, 103, 101, 45, 105, 100, 58, 60, 49,
        50, 56, 48, 48, 65, 57, 48, 45, 52, 69, 67, 67, 45, 52, 53, 49, 51, 45, 57, 50, 57, 56, 45,
        65, 51, 51, 53, 52, 54, 49, 50, 50, 57, 50, 48, 64, 109, 101, 46, 99, 111, 109, 62, 13, 10,
        100, 97, 116, 101, 58, 87, 101, 100, 44, 32, 51, 32, 65, 112, 114, 32, 50, 48, 50, 52, 32,
        49, 54, 58, 50, 51, 58, 52, 56, 32, 43, 48, 53, 51, 48, 13, 10, 116, 111, 58, 122, 107, 101,
        119, 116, 101, 115, 116, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109, 13, 10, 100, 107,
        105, 109, 45, 115, 105, 103, 110, 97, 116, 117, 114, 101, 58, 118, 61, 49, 59, 32, 97, 61,
        114, 115, 97, 45, 115, 104, 97, 50, 53, 54, 59, 32, 99, 61, 114, 101, 108, 97, 120, 101,
        100, 47, 114, 101, 108, 97, 120, 101, 100, 59, 32, 100, 61, 105, 99, 108, 111, 117, 100, 46,
        99, 111, 109, 59, 32, 115, 61, 49, 97, 49, 104, 97, 105, 59, 32, 116, 61, 49, 55, 49, 50,
        49, 52, 49, 54, 52, 52, 59, 32, 98, 104, 61, 50, 74, 115, 100, 75, 52, 66, 77, 122, 122,
        116, 57, 119, 52, 90, 108, 122, 50, 84, 100, 121, 86, 67, 70, 99, 43, 108, 55, 118, 78, 121,
        84, 53, 97, 65, 103, 71, 68, 89, 102, 55, 102, 77, 61, 59, 32, 104, 61, 102, 114, 111, 109,
        58, 67, 111, 110, 116, 101, 110, 116, 45, 84, 121, 112, 101, 58, 77, 105, 109, 101, 45, 86,
        101, 114, 115, 105, 111, 110, 58, 83, 117, 98, 106, 101, 99, 116, 58, 77, 101, 115, 115, 97,
        103, 101, 45, 73, 100, 58, 68, 97, 116, 101, 58, 116, 111, 59, 32, 98, 61,
    ]);

    let dkim_pubkey = RSAPubkey::new(
        [
            0xe5cf995b5ef59ce9943d1f4209b6ab,
            0xe0caf03235e91a2db27e9ed214bcc6,
            0xafe1309f87414bd36ed296dacfade2,
            0xbeff3f19046a43adce46c932514988,
            0x324041af8736e87de4358860fff057,
            0xadcc6669dfa346f322717851a8c22a,
            0x8b2a193089e6bf951c553b5a6f71aa,
            0x0a570fe582918c4f731a0002068df2,
            0x39419a433d6bfdd1978356cbca4b60,
            0x550d695a514d38b45c862320a00ea5,
            0x1c56ac1dfbf1beea31e8a613c2a51f,
            0x6a30c9f22d2e5cb6934263d0838809,
            0x0a281f268a44b21a4f77a91a52f960,
            0x5134dc3966c8e91402669a47cc8597,
            0x71590781df114ec072e641cdc5d224,
            0xa1bc0f0937489c806c1944fd029dc9,
            0x911f6e47f84db3b64c3648ebb5a127,
            0xd5,
        ],
        [
            0x48a824e4ebc7e0f1059f3ecfa57c46,
            0x5c1db23f3c7d47ad7e7d7cfda5189a,
            0x9bb6bbbd8facf011f022fa9051aec0,
            0x4faa4cef474bed639362ea71f7a217,
            0x503aa50b77e24b030841a7d0615812,
            0xbbf4e62805e1860a904c0f66a5fad1,
            0xcbd24b72442d2ce647dd7d0a443685,
            0x74a8839a4460c169dce7138efdaef5,
            0xf06e09e3191b995b08e5b45182f650,
            0x1fad4a89f8369fe10e5d4b6e149a10,
            0xc778b15982d11ebf7fe23b4e15f105,
            0x09ff3a4567077510c474e4ac0a21ad,
            0x37e69e5dbb77167b73065e4c5ad6aa,
            0xcf4774e22e7fe3a38642186f7ae74b,
            0x6e72b5eb4c813a3b37998083aab81e,
            0x48e7050aa8abedce5a45c169853761,
            0xd3285e53b322b221f7bcf4f8f8ad8a,
            0x132d,
        ],
    );
    let dkim_signature: [Field; KEY_LIMBS_2048] = [
        0xf193c3300b7c9902e32861c38d0d2d,
        0x9f6927fdb3df0b84092d8459654327,
        0x8a0bea5e2fa82821e49c27b68d5a7b,
        0xaa8c0acc1190f9fd845ef64f8e7ae9,
        0xa7aeebb37f4395965543e6df69a5a7,
        0x087ecef9921569cfba83331ca11c6b,
        0x4589ed316ed20757e65ad221736011,
        0x0835d8748f11dcc985700c3fea27b1,
        0xe870d2493fb83b4a1d72350e5de926,
        0x268b28eda0aac07625cfab32b60af1,
        0xb41a164eae7ba1602eaec5b5a39fe6,
        0x693cc5ec578422bee48eabe390fc37,
        0xa29504dd504f14423f2ce65b2ac388,
        0x6c3ac6310c084a0b126fcd5225c208,
        0xab0903e48563e5f4a5365ac5cbd888,
        0xf05bf2e5b6266c0ac88dfc733c414f,
        0xf58f9e9669e0f4f3086cce1187fd44,
        0xb9,
    ];

    let from_header_sequence: Sequence = Sequence { index: 0, length: 34 };
    let from_address_sequence: Sequence = Sequence { index: 5, length: 29 };
    let subject_header_sequence: Sequence = Sequence { index: 132, length: 15 };
    let mut domain: BoundedVec<u8, MAX_DOMAIN_LENGTH> = BoundedVec::new();
    for i in 0..9 {
        domain.storage[i] = "icloud.com".as_bytes()[i];
    }
    let ephemeral_pubkey: Field = 0;
    let ephemeral_pubkey_salt: Field = 0;
    let ephemeral_pubkey_expiry: u32 = 0;

    main(
        header,
        dkim_pubkey,
        dkim_signature,
        from_header_sequence,
        from_address_sequence,
        subject_header_sequence,
        domain,
        ephemeral_pubkey,
        ephemeral_pubkey_salt,
        ephemeral_pubkey_expiry,
    );
}
