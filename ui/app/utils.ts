export function signInWithGoogle({
  nonce,
  redirectPath = "",
}: { nonce?: string; redirectPath?: string } = {}) {
  const clientId =
    "654304047015-s536rk3rg5ucgq8pk8t8mjdv1019gb1j.apps.googleusercontent.com";
  const redirectUri = window.origin + redirectPath;
  const scope = "email profile";
  const responseType = "id_token";

  if (!nonce) {
    nonce = Array(32)
      .fill(0)
      .map(() => Math.random().toString(36)[2])
      .join("");
    localStorage.setItem("googleOAuthNonce", nonce);
  }

  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=${responseType}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&nonce=${nonce}`;

  window.location.href = url;
}

export function verifyNonceAndExtractPayload(idTokenStr: string) {
  // Verify stored nonce is same as the one in the token
  const storedNonce = localStorage.getItem("googleOAuthNonce");
  if (!idTokenStr || !storedNonce) {
    throw new Error("Invalid token or nonce");
  }

  const tokenPayload = JSON.parse(atob(idTokenStr.split(".")[1]));
  if (tokenPayload.nonce !== storedNonce) {
    throw new Error("Invalid nonce");
  }

  const payload = idTokenStr.split(".")[1];
  return JSON.parse(atob(payload));
}
