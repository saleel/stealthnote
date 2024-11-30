import { Html, Head } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta http-equiv="refresh" content="0; url=https://stealthnote.xyz" />
      </Head>
      <body>
        <div>
          Redirecting to{" "}
          <a href="https://stealthnote.xyz" rel="noopener noreferrer">
            https://stealthnote.xyz
          </a>
        </div>
      </body>
    </Html>
  );
}
