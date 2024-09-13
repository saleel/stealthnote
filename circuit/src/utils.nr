// base64 functions from zkemail.nr (TODO: switch to use it as a Nargo dep)
global MAX_PAYLOAD_LENGTH = 1024;

pub fn jwt_body_decode(payload_encoded: [u8; MAX_PAYLOAD_LENGTH], body_start_index: u32, data_length: u32) -> [u8; MAX_PAYLOAD_LENGTH * 6 / 8] {
    let mut total_bits = [0 as u1; MAX_PAYLOAD_LENGTH * 6];

    for i in 0..MAX_PAYLOAD_LENGTH {
        if i >= body_start_index {
            let translate = base64_lookup(payload_encoded[i] as u8);
            // Store as big endian
            let translate_bits: [u1; 6] = (translate as Field).to_be_bits();
            for j in 0..6 {
                total_bits[(i - body_start_index) * 6 + j] = translate_bits[j];
            }
        }
    }

    // Since we're returning the SHA256 hash, only need first 32 bytes (=256 bits)
    let mut output = [0 as u8; MAX_PAYLOAD_LENGTH * 6 / 8];
    for i in 0..MAX_PAYLOAD_LENGTH * 6 / 8 {
        for j in 0..8 {
            // Convert from big endian back to little endian
            output[i] |= (total_bits[i * 8 + j] as u8) << (7 - j) as u8;
        }
    }

    output
}

fn base64_lookup(input: u8) -> u8 {
    // A-Z: 65-90
    if input >= 65 & input <= 90 {
        input - 65
    } else if input >= 97 & input <= 122 {
        // a-z: 97-122
        input - 71
    } else if input >= 48 & input <= 57 {
        // 0-9: 48-57
        input + 4
    } else if input == 43 {
        // +
        62
    } else if input == 47 {
        // /
        63
    } else {
        // =
        0
    }
}
