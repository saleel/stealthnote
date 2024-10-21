import { useState, useEffect } from 'react';
import Layout from '../components/layout';

interface DecodedJWT {
  [key: string]: unknown;
}

const SLACK_CLIENT_ID = "295069689904.7901115482438";
const REDIRECT_URI = "http://localhost:3000/slack";

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

export default function SlackPage() {
  const [decodedJWT, setDecodedJWT] = useState<DecodedJWT | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      fetch('/api/slack/callback?code=' + code)
        .then(response => response.json())
        .then(data => {
          if (data.id_token) {
            const decoded = decodeJWT(data.id_token);
            setDecodedJWT(decoded);
          }
        })
        .catch(error => console.error('Error:', error));
    }
  }, []);

  const handleSlackSignIn = () => {
    const slackAuthUrl = new URL('https://slack.com/openid/connect/authorize');
    slackAuthUrl.searchParams.append('response_type', 'code');
    slackAuthUrl.searchParams.append('client_id', SLACK_CLIENT_ID);
    slackAuthUrl.searchParams.append('scope', 'openid profile email');
    slackAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    window.location.href = slackAuthUrl.toString();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Slack Sign-In</h1>
        {!decodedJWT && (
          <button
            onClick={handleSlackSignIn}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Sign in with Slack
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
