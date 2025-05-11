use std::{collections::bounded_vec::BoundedVec};
use zkemail::{
    dkim::RSAPubkey,
    headers::{email_address::get_email_address},
    KEY_LIMBS_2048,
    MAX_EMAIL_ADDRESS_LENGTH,
    Sequence,
};

global MAX_EMAIL_HEADER_LENGTH: u32 = 640;
global MAX_DOMAIN_LENGTH: u32 = 64;
global MAX_EMAIL_LENGTH: u32 = 320;

fn main(
    email_header: BoundedVec<u8, MAX_EMAIL_HEADER_LENGTH>,
    dkim_pubkey_moulus_limbs: pub [Field; KEY_LIMBS_2048],
    dkim_pubkey_redc_params_limbs: [Field; KEY_LIMBS_2048],
    dkim_signature: [Field; KEY_LIMBS_2048],
    from_header_sequence: Sequence,
    from_address_sequence: Sequence,
    to_header_sequence: Sequence,
    to_address_sequence: Sequence,
    domain: pub BoundedVec<u8, MAX_DOMAIN_LENGTH>,
    ephemeral_pubkey: pub Field,
) {
    assert(email_header.len() <= MAX_EMAIL_HEADER_LENGTH);

    // Verify DKIM signature
    let dkim_pubkey = RSAPubkey::new(dkim_pubkey_moulus_limbs, dkim_pubkey_redc_params_limbs);
    dkim_pubkey.verify_dkim_signature(email_header, dkim_signature);

    // Get from address
    let from_address = get_email_address(
        email_header,
        from_header_sequence,
        from_address_sequence,
        "from".as_bytes(),
    );

    // Assert domain match in From: email
    let from_domain_start_index = unsafe { get_domain_start_index_in_email(from_address) };
    assert(from_address.storage()[from_domain_start_index - 1] == 64, "char before domain is not '@'");
    for i in 0..MAX_DOMAIN_LENGTH {
        assert(
            from_address.storage()[from_domain_start_index + i] == domain.storage()[i],
            "invalid domain",
        );
    }

    // Get to address
    let to_address = get_email_address(
        email_header,
        to_header_sequence,
        to_address_sequence,
        "to".as_bytes(),
    );

    // Assert domain match in To: email
    let to_domain_start_index = unsafe { get_domain_start_index_in_email(to_address) };
    assert(to_address.storage()[to_domain_start_index - 1] == 64, "char before domain is not '@'");
    for i in 0..MAX_DOMAIN_LENGTH {
        assert(
            to_address.storage()[to_domain_start_index + i] == domain.storage()[i],
            "invalid domain",
        );
    }
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
