import React, { useState } from "react";
import Image from "next/image";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";
import { SignedMessage, SignedMessageWithProof } from "../lib/types";
import {
  verifyMessage,
  fetchMessage,
  generateNameFromPubkey,
  getLogoUrl,
} from "../lib/utils";
import Link from "next/link";

interface MessageCardProps {
  message: SignedMessage;
  isInternal?: boolean;
}

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-US");

const MessageCard: React.FC<MessageCardProps> = ({ message, isInternal }) => {
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
  const logoUrl = getLogoUrl(message.domain);
  const shouldRedirect = window.location.pathname !== `/${message.domain}`;

  function renderLogo() {
    if (isInternal) {
      return null;
    }

    if (shouldRedirect) {
      return (
        <Link href={`/${message.domain}`} className="message-card-header-logo">
          <Image
            src={logoUrl}
            alt={`${message.domain} logo`}
            width={40}
            height={40}
          />
        </Link>
      );
    }

    return (
      <div className="message-card-header-logo">
        <Image
          src={logoUrl}
          alt={`${message.domain} logo`}
          className="message-card-header-logo"
          width={40}
          height={40}
        />
      </div>
    );
  }

  function renderSender() {
    if (isInternal) {
      return (
        <div className="message-card-header-sender-name internal">
          <span>{generateNameFromPubkey(message.pubkey || "")}</span>
          <span
            className="message-card-header-timestamp"
            title={timestamp.toLocaleString()}
          >
            {timeAgo.format(timestamp)}
          </span>
        </div>
      );
    }

    return (
      <span>
        <div className="message-card-header-sender-text">
          <span>Someone from</span>
        </div>
        <div className="message-card-header-sender-name">
          {shouldRedirect ? (
            <Link href={`/${message.domain}`}>{message.domain}</Link>
          ) : (
            <span>{message.domain}</span>
          )}
          <span
            className="message-card-header-timestamp"
            title={timestamp.toLocaleString()}
          >
            {timeAgo.format(timestamp)}
          </span>
        </div>
      </span>
    );
  }

  return (
    <div className="message-card">
      <header className="message-card-header">
        <div className="message-card-header-sender">
          {renderLogo()}
          {renderSender()}
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
