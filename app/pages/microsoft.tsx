"use client";

import { useState, useEffect } from 'react';
import Layout from '../components/layout';

interface DecodedJWT {
  [key: string]: unknown;
}

const MS_CLIENT_ID = "YOUR_MICROSOFT_CLIENT_ID"; // Replace with your actual client ID
const REDIRECT_URI = "https://wild-chefs-jam.loca.lt/microsoft";

function decodeJWT(token: string): DecodedJWT {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return {};
  }
}

// PKCE helper functions
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64URLEncode(array);
}

function base64URLEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(hash);
}

export default function MicrosoftPage() {
  const [decodedJWT, setDecodedJWT] = useState<DecodedJWT | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const storedVerifier = sessionStorage.getItem('code_verifier');

    if (code && storedVerifier) {
      setIsLoading(true);
      
      // Exchange code using PKCE
      fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: MS_CLIENT_ID,
          scope: 'openid profile email',
          code: code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
          code_verifier: storedVerifier,
        }),
      })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        if (data.id_token) {
          const decoded = decodeJWT(data.id_token);
          setDecodedJWT(decoded);
        }
        sessionStorage.removeItem('code_verifier');
      })
      .catch(error => console.error('Error:', error))
      .finally(() => setIsLoading(false));
    }
  }, []);

  const handleMicrosoftSignIn = async () => {
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store verifier for later use
    sessionStorage.setItem('code_verifier', codeVerifier);

    // Build authorization URL with PKCE
    const msAuthUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    msAuthUrl.searchParams.append('response_type', 'code');
    msAuthUrl.searchParams.append('client_id', MS_CLIENT_ID);
    msAuthUrl.searchParams.append('scope', 'openid profile email');
    msAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    msAuthUrl.searchParams.append('code_challenge', codeChallenge);
    msAuthUrl.searchParams.append('code_challenge_method', 'S256');
    msAuthUrl.searchParams.append('response_mode', 'query');
    
    window.location.href = msAuthUrl.toString();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Microsoft Sign-In</h1>
        {isLoading && <p>Loading...</p>}
        {!decodedJWT && !isLoading && (
          <button
            onClick={handleMicrosoftSignIn}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Sign in with Microsoft
          </button>
        )}
        {decodedJWT && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Decoded JWT:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
              {JSON.stringify(decodedJWT, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Layout>
  );
} 