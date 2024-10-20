import React, { useState } from "react";
import {
  submitMessage,
  getDomain,
  isRegistered as isRegisteredFn,
  generateKeyPairAndRegister,
} from "../lib/utils";
import dynamic from "next/dynamic";
import SignInButton from "./siwg";

const MessageForm: React.FC = () => {
  const [message, setMessage] = useState("");
  const [isRegistered, setIsRegistered] = useState(isRegisteredFn());
  const [userDomain, setUserDomain] = useState<string | null>(getDomain());
  const [isPosting, setIsPosting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [status, setStatus] = useState(
    isRegistered
      ? `Posting as "Someone from ${userDomain}"`
      : `Sign in with your Google work account to anonymously post as "Someone from your company"`
  );

  async function handleSignIn() {
    try {
      setIsSigningIn(true);
      await generateKeyPairAndRegister(setStatus);
      const newDomain = getDomain();

      setIsRegistered(true);
      setUserDomain(newDomain);
      setStatus(`Posting as "Someone from ${newDomain}"`);
    } catch (error) {
      console.error("Error:", error);
      setStatus(`Error: ${(error as Error).message}`);
    } finally {
      setIsSigningIn(false);
    }
  }

  async function onSubmitMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setIsPosting(true);

    try {
      const domain = getDomain();
      if (!domain) throw new Error("Domain not found");

      await submitMessage(message, domain, false);
      setMessage("");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <div className="message-form">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          isRegistered
            ? `What is happening at ${userDomain}?`
            : `What is happening at your company?`
        }
        maxLength={280}
        disabled={!isRegistered || isPosting}
      />
      <div className="message-form-footer">
        {isRegistered && (
          <span className="message-form-character-count">
            {message.length}/280
          </span>
        )}

        <span className="message-form-footer-message">{status}</span>

        {isRegistered && (
          <button
            className="message-form-footer-button"
            onClick={onSubmitMessage}
            disabled={isPosting || message.length === 0}
          >
            {isPosting ? <span className="spinner-icon small" /> : "Post"}
          </button>
        )}

        {!isRegistered && (
          <SignInButton onClick={handleSignIn} isLoading={isSigningIn} />
        )}
      </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(MessageForm), {
  ssr: false,
});
