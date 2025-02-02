import { useEffect } from "react";

export default function SlackCallback() {
  useEffect(() => {
    async function handleCallback() {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        const code = queryParams.get("code");
        const error = queryParams.get("error");
        const state = queryParams.get("state");

        if (error) {
          throw new Error(error as string);
        }

        // Verify state
        const storedState = sessionStorage.getItem("slack_auth_state");
        if (!state || state !== storedState) {
          throw new Error("Invalid state parameter");
        }

        if (!code) throw new Error("code not found");

        // Exchange code for tokens
        const tokenResponse = await fetch(
          "https://slack.com/api/openid.connect.token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id:
                process.env.NEXT_PUBLIC_SLACK_CLIENT_ID ||
                "295069689904.7901115482438",
              code: String(code),
              redirect_uri: `${
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
              }/slack/callback`,
              client_secret:
                process.env.SLACK_CLIENT_SECRET ||
                "570d826305d853e5d94d9da1ef0b26c9",
            }),
          }
        );

        const data = await tokenResponse.json();

        if (!tokenResponse.ok || !data.id_token) {
          throw new Error(data.error || "Failed to exchange code for tokens");
        }

        // Clean up
        sessionStorage.removeItem("slack_auth_state");

        // Store the id_token and redirect
        localStorage.setItem("id_token", data.id_token);
        console.log("id_token", data.id_token);
        // router.push('/dashboard');

        if (data.id_token && state) {
          window.opener.postMessage(
            { type: "SLACK_SIGN_IN_SUCCESS", idToken: data.id_token, state },
            window.location.origin
          );
        }
      } catch (err) {
        window.opener.postMessage(
          {
            type: "SLACK_SIGN_IN_ERROR",
            error: err instanceof Error ? err.message : "An error occurred",
          },
          window.location.origin
        );
      } finally {
        window.close();
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div>Processing Slack authentication...</div>
    </div>
  );
}
