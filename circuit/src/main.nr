use dep::jwt::JWT;
use string_search::{StringBody, SubString};

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
    b64_offset: u32,
    pubkey_modulus_limbs: pub [Field; 18],
    redc_params_limbs: [Field; 18],
    signature_limbs: [Field; 18],
    // email: pub BoundedVec<u8, MAX_EMAIL_LENGTH>,
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

    let email: BoundedVec<u8, MAX_EMAIL_LENGTH> = jwt.get_value::<420, 5, MAX_EMAIL_LENGTH>("email".as_bytes());
    // jwt.validate_key_value::<420, 14, 4>(
    //     "email_verified".as_bytes(),
    //     BoundedVec::from_array("true".as_bytes()),
    // );
    jwt.validate_key_value::<420, 5, 32>("nonce".as_bytes(), nonce);

    // Ensure domain is present in the email address
    let haystack: StringBody<((MAX_EMAIL_LENGTH + 31) / 31) * 31, (MAX_EMAIL_LENGTH + 31) / 31, MAX_EMAIL_LENGTH> =
        StringBody::new(email.storage(), email.len());

    // key is the needle
    let needle: SubString<((MAX_DOMAIN_LENGTH + 31) / 31) * 31, MAX_DOMAIN_LENGTH / 31, MAX_DOMAIN_LENGTH> =
        SubString::new(domain.storage(), domain.len());

    let (match, position): (bool, u32) = haystack.substring_match(needle);

    assert(match, "key not found");

    println("match");
    println(match);
    println("position");
    println(position);

    // TODO:
    // validate exp - is there a chance the token is expired? Do we care?
    // validate aud - is there a chance the token was generated for a different app?
    // validate is_email_verified? - can users create accounts without verifying their email?
}

#[test]
fn test() {
    let partial_data: BoundedVec<u8, MAX_PARTIAL_DATA_LENGTH> = BoundedVec::from_array([
        68, 107, 48, 78, 122, 103, 51, 78, 68, 107, 48, 77, 84, 103, 119, 77, 68, 77, 48, 78, 106,
        69, 105, 76, 67, 74, 111, 90, 67, 73, 54, 73, 109, 70, 54, 100, 71, 86, 106, 99, 72, 74,
        118, 100, 71, 57, 106, 98, 50, 119, 117, 89, 50, 57, 116, 73, 105, 119, 105, 90, 87, 49,
        104, 97, 87, 119, 105, 79, 105, 74, 122, 89, 87, 120, 108, 90, 87, 120, 65, 89, 88, 112, 48,
        90, 87, 78, 119, 99, 109, 57, 48, 98, 50, 78, 118, 98, 67, 53, 106, 98, 50, 48, 105, 76, 67,
        74, 108, 98, 87, 70, 112, 98, 70, 57, 50, 90, 88, 74, 112, 90, 109, 108, 108, 90, 67, 73,
        54, 100, 72, 74, 49, 90, 83, 119, 105, 98, 109, 57, 117, 89, 50, 85, 105, 79, 105, 74, 108,
        90, 84, 99, 48, 89, 106, 103, 121, 89, 87, 70, 108, 77, 122, 85, 50, 90, 106, 107, 48, 77,
        122, 107, 121, 78, 68, 66, 104, 89, 106, 108, 107, 77, 84, 77, 48, 90, 109, 73, 122, 90, 67,
        73, 115, 73, 109, 53, 105, 90, 105, 73, 54, 77, 84, 99, 122, 78, 106, 65, 49, 78, 84, 73,
        48, 77, 121, 119, 105, 98, 109, 70, 116, 90, 83, 73, 54, 73, 108, 78, 104, 98, 71, 86, 108,
        98, 67, 66, 81, 97, 87, 78, 111, 90, 87, 52, 105, 76, 67, 74, 119, 97, 87, 78, 48, 100, 88,
        74, 108, 73, 106, 111, 105, 97, 72, 82, 48, 99, 72, 77, 54, 76, 121, 57, 115, 97, 68, 77,
        117, 90, 50, 57, 118, 90, 50, 120, 108, 100, 88, 78, 108, 99, 109, 78, 118, 98, 110, 82,
        108, 98, 110, 81, 117, 89, 50, 57, 116, 76, 50, 69, 118, 81, 85, 78, 110, 79, 71, 57, 106,
        83, 84, 85, 53, 77, 68, 70, 54, 86, 122, 90, 86, 81, 85, 78, 71, 89, 109, 107, 48, 97, 85,
        112, 117, 87, 88, 78, 87, 77, 84, 108, 51, 86, 85, 74, 67, 86, 50, 112, 77, 90, 50, 108,
        114, 78, 85, 85, 119, 77, 109, 90, 97, 90, 69, 100, 50, 84, 85, 53, 122, 85, 109, 82, 66,
        80, 88, 77, 53, 78, 105, 49, 106, 73, 105, 119, 105, 90, 50, 108, 50, 90, 87, 53, 102, 98,
        109, 70, 116, 90, 83, 73, 54, 73, 108, 78, 104, 98, 71, 86, 108, 98, 67, 73, 115, 73, 109,
        90, 104, 98, 87, 108, 115, 101, 86, 57, 117, 89, 87, 49, 108, 73, 106, 111, 105, 85, 71,
        108, 106, 97, 71, 86, 117, 73, 105, 119, 105, 97, 87, 70, 48, 73, 106, 111, 120, 78, 122,
        77, 50, 77, 68, 85, 49, 78, 84, 81, 122, 76, 67, 74, 108, 101, 72, 65, 105, 79, 106, 69, 51,
        77, 122, 89, 119, 78, 84, 107, 120, 78, 68, 77, 115, 73, 109, 112, 48, 97, 83, 73, 54, 73,
        109, 85, 122, 77, 84, 103, 120, 78, 71, 73, 53, 77, 109, 77, 50, 89, 122, 89, 49, 79, 71,
        77, 52, 78, 106, 77, 122, 77, 68, 103, 120, 79, 84, 107, 50, 78, 84, 70, 104, 90, 84, 85,
        51, 77, 109, 82, 107, 90, 87, 89, 48, 79, 84, 65, 105, 102, 81,
    ]);
    let domain: BoundedVec<u8, MAX_DOMAIN_LENGTH> = BoundedVec::from_array([
        97, 122, 116, 101, 99, 112, 114, 111, 116, 111, 99, 111, 108, 46, 99, 111, 109,
    ]);
    let nonce: BoundedVec<u8, NONCE_LENGTH> = BoundedVec::from_array([
        101, 101, 55, 52, 98, 56, 50, 97, 97, 101, 51, 53, 54, 102, 57, 52, 51, 57, 50, 52, 48, 97,
        98, 57, 100, 49, 51, 52, 102, 98, 51, 100,
    ]);

    main(
        partial_data,
        [
            3053121375, 4109059093, 2655226424, 64893154, 2570246866, 2902447631, 688747246,
            3588666950,
        ],
        945,
        3,
        [
            162021587656394082664959243393354967,
            69747376089373674946290574910715550,
            850986922249099437219810825276399705,
            1033876533498607448659926546666749191,
            773140069918256047879530098784338499,
            531114876678023760164266311697238303,
            892582485242276956233941141658404699,
            74717360054686744127720327140186239,
            1284491559055503242995966178694330787,
            1043280120557146246088789641189484533,
            324946202168650294077822608599483456,
            1167379036417016142360635182298872455,
            688559545459023135644640809408043601,
            677994684073135204013150735779735983,
            701679890235079506419763042218031591,
            1122606517029235807071971102037492513,
            1260848000915173625722524616021960846,
            194,
        ],
        [
            372120058035307967361671191956489862,
            356628432024545970507451021519887364,
            504117396353937575805458729932683584,
            1106858791785412484802517618538736995,
            1328779132890142627903999884579926561,
            648633754217527211617263762389219153,
            326885114207268558229890087274185657,
            640368229030506491094141195777241158,
            1078319725186684954605961496287840199,
            30622973758870825887620746717975168,
            110542035963806925297313633939841184,
            540449499589628476848677536131437021,
            1094903794712398364343669984105766775,
            637669563514520248186901954086235668,
            1302338498482175540716827483704693407,
            1304190258698642351073894126800172175,
            972723595764587170776260914745501017,
            5378,
        ],
        [
            1158266004949601355269846777675350461,
            316533854872082949049960012591009341,
            21260001325715658901645609963037597,
            858503393895444881879701928994614595,
            417462293352355381876521135254394658,
            1272396909530334875693625938842989943,
            387544292818239951908256362189688128,
            1105346839559548410948112132634696992,
            756154357078516232151641808543864796,
            1301947986367848018000241479882214387,
            364412340114246114594031517514568119,
            1286945084132599590253580576838813748,
            744735531799448982240836261735334581,
            123467545470268895084385407704098998,
            928244484056969134528606093043366515,
            878879585616324817325399782103422871,
            788410813381477174037529731173589646,
            57,
        ],
        domain,
        nonce,
    );
}
