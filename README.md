# StealthNote

StealthNote is an application for people in an organization to anonymously broadcast messages.

We use Zero Knowledge Proofs to prove that you are part of an organization by verifying JWT token generated for your Google Workspace account.

Try it out at [stealthnote.xyz](https://stealthnote.xyz).

## Run locally

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

```
nargo version 0.38.0
bb version 0.61.0
```

```sh
#PWD = circuits
./build.sh
```

<br />

Built with [Noir](https://www.noir-lang.org/). 

Inspired by [Blind](https://www.teamblind.com/), [Nozee](https://www.nozee.xyz/).
