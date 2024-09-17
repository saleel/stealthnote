# StealthNote

StealthNote is an application for people in an organization to anonymously broadcast messages.

we use Zero Knowledge Proofs to prove that you are part of an organization by verifying JWT token generated for your Google Workspace account.

## How to run

Set your environment variables:
```sh
# Supabase credentials
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Google Client ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

Run below commands to start the Next.js app:
```sh
#PWD = app
yarn
yarn dev
```

<br />

## Building circuits

```sh
#PWD = circuits
nargo compile
```

- Copy `circuits/target/circui.json` to `app/assets/circuit.json`
- Uncomment [these lines](./app/lib/utils.ts#L13) to generate new vkey and save it to `app/assets/circuit-vkey.json`

<br />

Built with [Noir](https://www.noir-lang.org/). Inspiration: [https://www.nozee.xyz/](https://www.nozee.xyz/)
