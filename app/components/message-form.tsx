import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useLocalStorage } from "@uidotdev/usehooks";
import { Message, SignedMessageWithProof } from "../lib/types";
import { getEphemeralPubkey } from "../lib/key";
import { generateKeyPairAndRegister, postMessage } from "../lib/core";
import { generateNameFromPubkey } from "../lib/utils";
import { Providers } from "../lib/providers";
import SignInButton from "./siwg";

type MessageFormProps = {
  isInternal?: boolean;
  onSubmit: (message: SignedMessageWithProof) => void;
};

const MessageForm: React.FC<MessageFormProps> = ({ isInternal, onSubmit }) => {
  const [currentGroupId, setCurrentGroupId] = useLocalStorage<string | null>(
    "currentGroupId",
    null
  );
  const [currentProvider, setCurrentProvider] = useLocalStorage<string | null>(
    "currentProvider",
    null
  );

  const provider = currentProvider ? Providers[currentProvider] : null;
  const anonGroup =
    provider && currentGroupId ? provider.getAnonGroup(currentGroupId) : null;

  const isRegistered = !!currentGroupId;
  const senderName = isInternal
    ? generateNameFromPubkey(getEphemeralPubkey() as string)
    : `Someone from ${anonGroup?.title}`;

  // State
  const [message, setMessage] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState(
    !isRegistered
      ? `Sign in with your Google work account to anonymously post as "Someone from your company"`
      : ""
  );

  // Handlers
  async function handleSignIn(providerName: string) {
    try {
      setIsRegistering(true);

      const { anonGroup } = await generateKeyPairAndRegister(providerName);

      setCurrentGroupId(anonGroup.id);
      setCurrentProvider(providerName);
    } catch (error) {
      console.error("Error:", error);
      setStatus(`Error: ${(error as Error).message}`);
    } finally {
      setIsRegistering(false);
    }
  }

  async function onSubmitMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setIsPosting(true);

    try {
      const messageObj: Message = {
        id: crypto.randomUUID().split("-").slice(0, 2).join(""),
        timestamp: new Date().getTime(),
        text: message,
        internal: !!isInternal,
        likes: 0,
        anonGroupId: currentGroupId as string,
        anonGroupProvider: currentProvider as string,
      };

      const signedMessage = await postMessage(messageObj);

      setMessage("");
      onSubmit(signedMessage as SignedMessageWithProof);
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setIsPosting(false);
    }
  }

  const isTextAreaDisabled = isRegistering || isPosting || !isRegistered;

  return (
    <div className="message-form">
      <div style={{ position: "relative" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            isRegistered
              ? `What is happening at ${currentGroupId}?`
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
          <span className="message-form-footer-message">
            {status ? status : `Posting as "${senderName}"`}
          </span>

          {isRegistered && (
            <button
              className="message-form-refresh-button"
              title={
                "Multiple messages sent by one identity can be linked." +
                " Refresh your identity by generating a new proof."
              }
              onClick={() => handleSignIn("google-oauth")}
              disabled={isRegistering}
              tabIndex={-1}
            >
              {isRegistering ? (
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
              disabled={isRegistering || isPosting || message.length === 0}
            >
              {isPosting ? <span className="spinner-icon small" /> : "Post"}
            </button>
          </>
        )}

        {!isRegistered && (
          <SignInButton
            onClick={() => handleSignIn("google-oauth")}
            isLoading={isRegistering}
          />
        )}
      </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(MessageForm), {
  ssr: false,
});
