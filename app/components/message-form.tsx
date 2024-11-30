import React, { useState } from "react";
import {
  submitMessage,
  generateKeyPairAndRegister,
  generateNameFromPubkey,
  getPubkeyString,
  initProver,
  initVerifier,
} from "../lib/utils";
import dynamic from "next/dynamic";
import SignInButton from "./siwg";
import { useLocalStorage } from "@uidotdev/usehooks";
import { SignedMessageWithProof } from "../lib/types";

const MessageForm: React.FC<{
  isInternal?: boolean;
  onSubmit: (message: SignedMessageWithProof) => void;
}> = ({ isInternal, onSubmit }) => {
  const [currentDomain, setCurrentDomain] = useLocalStorage<string | null>(
    "currentDomain",
    null
  );
  const isRegistered = !!currentDomain;
  const senderName = isInternal
    ? generateNameFromPubkey(getPubkeyString() || "")
    : `Someone from ${currentDomain}`;

  const [message, setMessage] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [status, setStatus] = useState(
    isRegistered
      ? `Posting as "${senderName}"`
      : `Sign in with your Google work account to anonymously post as "Someone from your company"`
  );

  React.useEffect(() => {
    initProver();
    initVerifier();
  }, []);

  async function handleSignIn() {
    try {
      setIsSigningIn(true);
      const { domain } = await generateKeyPairAndRegister(setStatus);

      setCurrentDomain(domain);

      const newName = isInternal
        ? generateNameFromPubkey(getPubkeyString() || "")
        : `Someone from ${domain}`;
      setStatus(`Posting as "${newName}"`);
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
      const signedMessage = (await submitMessage(
        message,
        currentDomain as string,
        !!isInternal
      )) as SignedMessageWithProof;
      setMessage("");
      onSubmit(signedMessage);
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setIsPosting(false);
    }
  }

  const isTextAreaDisabled = isSigningIn || isPosting || !isRegistered;

  return (
    <div className="message-form">
      <div style={{ position: "relative" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            isRegistered
              ? `What is happening at ${currentDomain}?`
              : `What is happening at your company?`
          }
          maxLength={280}
          disabled={isTextAreaDisabled}
        />
        {!isTextAreaDisabled && message.length > 0 && (
          <span className="message-form-character-count">
            {message.length}/280
          </span>
        )}
      </div>

      <div className="message-form-footer">
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="message-form-footer-message">{status}</span>
          {isRegistered && (
            <button
              className="message-form-refresh-button"
              title={
                "Multiple messages sent by one identity can be linked." +
                " Refresh your identity by generating a new proof."
              }
              onClick={handleSignIn}
              disabled={isSigningIn}
              tabIndex={-1}
            >
              {isSigningIn ? (
                <span className="spinner-icon" />
              ) : (
                <span className="message-form-refresh-icon">⟳</span>
              )}
            </button>
          )}
        </div>

        {isRegistered && (
          <>
            <button
              className="message-form-post-button"
              onClick={onSubmitMessage}
              disabled={isSigningIn || isPosting || message.length === 0}
            >
              {isPosting ? <span className="spinner-icon small" /> : "Post"}
            </button>
          </>
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
