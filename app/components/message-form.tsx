import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useLocalStorage } from "@uidotdev/usehooks";
import IonIcon from "@reacticons/ionicons";
import { LocalStorageKeys, Message, SignedMessageWithProof } from "../lib/types";
import { getEphemeralPubkey } from "../lib/ephemeral-key";
import { registerMembership, postMessage } from "../lib/core";
import { generateNameFromPubkey } from "../lib/utils";
import { Providers } from "../lib/providers";
import SignWithGoogleButton from "./siwg";
import ProveByEmailButton from "./prove-by-email-button";
// import SignInWithMicrosoftButton from "./siwm";

type MessageFormProps = {
  isInternal?: boolean;
  onSubmit: (message: SignedMessageWithProof) => void;
};

const prompts = (companyName: string) => [
  `What’s the tea at ${companyName}?`,
  `What’s going unsaid at ${companyName}?`,
  `What’s happening behind the scenes at ${companyName}?`,
  `What would you say if you weren’t being watched?`,
  `What’s the thing nobody’s admitting at ${companyName}?`,
];
const randomPromptIndex = Math.floor(Math.random() * prompts("").length);

const MessageForm: React.FC<MessageFormProps> = ({ isInternal, onSubmit }) => {
  const [currentGroupId, setCurrentGroupId] = useLocalStorage<string | null>(
    "currentGroupId",
    null
  );
  const [currentProvider, setCurrentProvider] = useLocalStorage<string | null>(
    LocalStorageKeys.CurrentProvider,
    null
  );

  const provider = currentProvider ? Providers[currentProvider] : null;
  const anonGroup =
    provider && currentGroupId ? provider.getAnonGroup(currentGroupId) : null;

  const isRegistered = !!currentGroupId;
  const senderName = isInternal
    ? generateNameFromPubkey(getEphemeralPubkey()?.toString() ?? "")
    : `Someone from ${anonGroup?.title}`;

  const welcomeMessage = `
    Sign in with your Google work account to anonymously post as "Someone from your company".
  `;

  // State
  const [message, setMessage] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isRegistering, setIsRegistering] = useState("");
  const [status, setStatus] = useState(!isRegistered ? welcomeMessage : "");


  // Handlers
  async function handleSignIn(providerName: string, args?: any) {
    try {
      setIsRegistering(providerName);
      setStatus(`Generating cryptographic proof of your membership without revealing your identity.
        This will take about 20 seconds...`);

      const { anonGroup } = await registerMembership(providerName, args);

      setCurrentGroupId(anonGroup.id);
      setCurrentProvider(providerName);
      setStatus("");
    } catch (error) {
      console.error("Error:", error);
      setStatus(`Error: ${(error as Error).message}`);
    } finally {
      setIsRegistering("");
    }
  }

  async function resetIdentity() {
    setCurrentGroupId(null);
    setCurrentProvider(null);
    setStatus(welcomeMessage);
  }

  async function onSubmitMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setIsPosting(true);

    try {
      const messageObj: Message = {
        id: crypto.randomUUID().split("-").slice(0, 2).join(""),
        timestamp: new Date(),
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

  const isTextAreaDisabled = !!isRegistering || isPosting || !isRegistered;

  const randomPrompt = prompts(currentGroupId ?? "your company")[randomPromptIndex]


  return (
    <div className="message-form">
      <div style={{ position: "relative" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={randomPrompt}
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
            <div className="message-form-footer-buttons">
              <button
                title={
                  "Multiple messages sent by one identity can be linked." +
                  " Refresh your identity by generating a new proof."
                }
                onClick={() => handleSignIn("google-oauth")}
                tabIndex={-1}
              >
                {isRegistering ? (
                  <span className="spinner-icon" />
                ) : (
                  <span className="message-form-refresh-icon">⟳</span>
                )}
              </button>
              <button
                title={
                  "Delete your identity and start over."
                }
                onClick={() => resetIdentity()}
                tabIndex={-1}
              >
                <span className="message-form-reset-icon"><IonIcon name="close-outline" /></span>
              </button>
            </div>
          )}
        </div>

        {isRegistered && (
          <>
            <button
              className="message-form-post-button"
              onClick={onSubmitMessage}
              disabled={!!isRegistering || isPosting || message.length === 0}
            >
              {isPosting ? <span className="spinner-icon small" /> : "Post"}
            </button>
          </>
        )}

        {!isRegistered && (
          <div className="message-form-oauth-buttons">
            <SignWithGoogleButton
              onClick={() => handleSignIn("google-oauth")}
              isLoading={isRegistering === "google-oauth"}
              disabled={!!isRegistering}
            />
            <ProveByEmailButton
              onSubmitEmail={(args) => handleSignIn("prove-by-email", args)}
              isLoading={isRegistering === "prove-by-email"}
              disabled={!!isRegistering}
            />
            {/* <SignInWithMicrosoftButton
              onClick={() => handleSignIn("microsoft-oauth")}
              isLoading={isRegistering === "microsoft-oauth"}
              disabled={!!isRegistering}
            /> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(MessageForm), {
  ssr: false,
});
