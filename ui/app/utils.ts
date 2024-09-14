import { Message } from "./types";

export function signInWithGoogle({
  nonce,
  redirectPath = "",
}: { nonce?: string; redirectPath?: string } = {}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error('Google Client ID is not set');
    return;
  }

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

export async function fetchMessages(domain: string) {
  const response = await fetch(`/api/messages?domain=${domain}`);
  if (response.ok) {
    const data = await response.json();
    return data;
  } else {
    throw new Error("Failed to fetch messages");
  }
}

export async function submitMessage(message: Message) {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (response.ok) {
    return response.json();
  } else {
    let errorMessage = response.statusText;

    try {
      const errorData = await response.json();
      errorMessage = JSON.stringify(errorData);
    } catch (error) {
      //
    }

    throw new Error(errorMessage);
  }
}