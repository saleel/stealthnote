import { useState } from 'react';

export default function SlackAuth() {
  const [isLoading, setIsLoading] = useState(false);

  const SLACK_CLIENT_ID = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID || '295069689904.7901115482438';
  const SLACK_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/slack/callback`;
  const SLACK_SCOPE = 'openid profile email';

  const handleSlackSignIn = async () => {
    setIsLoading(true);
    
    try {
      // Generate state for security
      const state = crypto.randomUUID();
      sessionStorage.setItem('slack_auth_state', state);
      
      // Construct authorization URL
      const authUrl = new URL('https://slack.com/openid/connect/authorize');
      authUrl.searchParams.append('client_id', SLACK_CLIENT_ID!);
      authUrl.searchParams.append('redirect_uri', SLACK_REDIRECT_URI);
      authUrl.searchParams.append('scope', SLACK_SCOPE);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('nonce', crypto.randomUUID()); // Required for OpenID Connect
      
      // Redirect to Slack authorization page
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Error initiating Slack sign-in:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <button
        onClick={handleSlackSignIn}
        disabled={isLoading}
        className="bg-slack-color hover:bg-slack-color-dark text-white font-bold py-2 px-4 rounded flex items-center"
      >
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <>
            <img 
              src="/slack-logo.svg" 
              alt="Slack logo" 
              className="w-5 h-5 mr-2" 
            />
            Sign in with Slack
          </>
        )}
      </button>
    </div>
  );
}
