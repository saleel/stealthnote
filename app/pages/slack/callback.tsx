import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function SlackCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const { code, error: urlError, state } = router.query;

      if (urlError) {
        setError(String(urlError));
        return;
      }

      // Verify state
      const storedState = sessionStorage.getItem('slack_auth_state');
      if (!state || state !== storedState) {
        setError('Invalid state parameter');
        return;
      }

      if (!code) return;

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://slack.com/api/openid.connect.token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_SLACK_CLIENT_ID || '295069689904.7901115482438',
            code: String(code),
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/slack/callback`,
            client_secret: process.env.SLACK_CLIENT_SECRET || '',
          }),
        });

        const data = await tokenResponse.json();

        if (!tokenResponse.ok || !data.id_token) {
          throw new Error(data.error || 'Failed to exchange code for tokens');
        }

        // Clean up
        sessionStorage.removeItem('slack_auth_state');

        // Store the id_token and redirect
        localStorage.setItem('id_token', data.id_token);
        console.log('id_token', data.id_token);
        // router.push('/dashboard');
      } catch (err) {
        console.error('Error during token exchange:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    }

    if (router.isReady) {
      handleCallback();
    }
  }, [router.isReady, router.query]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div>Processing authentication...</div>
    </div>
  );
} 