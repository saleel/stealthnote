import React, { useState } from "react";
import Image from "next/image";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";
import { SignedMessage, SignedMessageWithProof } from "../lib/types";
import {
  verifyMessage,
  fetchMessage,
  generateNameFromPubkey,
} from "../lib/utils";

interface MessageCardProps {
  message: SignedMessage;
}

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-US");

const MessageCard: React.FC<MessageCardProps> = ({ message }) => {
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "verifying" | "valid" | "invalid" | "error"
  >("idle");

  const onVerify = async () => {
    setVerificationStatus("verifying");

    try {
      const fullMessage = (await fetchMessage(
        message.id,
        message.internal
      )) as SignedMessageWithProof;
      const isValid = await verifyMessage(fullMessage);
      setVerificationStatus(isValid ? "valid" : "invalid");
    } catch (error) {
      console.error("Verification failed:", error);
      setVerificationStatus("error");
    }
  };

  const timestamp = new Date(message.timestamp);
  const logoUrl = `https://img.logo.dev/${message.domain}?token=pk_SqdEexoxR3akcyJz7PneXg`;

  let sender = "";
  if (message.internal) {
    sender = generateNameFromPubkey(message.pubkey || "");
  } else {
    sender = message.domain;
  }

  return (
    <div className="message-card">
      <header className="message-card-header">
        <div className="message-card-header-sender">
          <Image
            src={logoUrl}
            alt={`${message.domain} logo`}
            className="message-card-header-logo"
            width={40}
            height={40}
          />
          <span>
            <div className="message-card-header-sender-text">
              <span>Someone from</span>
            </div>
            <div className="message-card-header-sender-name">
              {sender}
              <span
                className="message-card-header-timestamp"
                title={timestamp.toLocaleString()}
              >
                {timeAgo.format(timestamp)}
              </span>
            </div>
          </span>
        </div>

        {verificationStatus === "idle" && (
          <div>
            <span className="message-card-verify-button" onClick={onVerify}>
              {verificationStatus === "idle" && "Verify"}
            </span>
          </div>
        )}

        {verificationStatus !== "idle" && (
          <span className={`message-card-verify-status ${verificationStatus}`}>
            {verificationStatus === "verifying" && (
              <span className="message-card-verify-icon spinner-icon small"></span>
            )}
            {verificationStatus === "valid" && (
              <span className="message-card-verify-icon valid">✓</span>
            )}
            {verificationStatus === "invalid" && (
              <span className="message-card-verify-icon invalid">+</span>
            )}
            {verificationStatus === "error" && (
              <span className="message-card-verify-icon error">!</span>
            )}
          </span>
        )}
      </header>

      <main className="message-card-content">{message.text}</main>
    </div>
  );
};

export default MessageCard;
