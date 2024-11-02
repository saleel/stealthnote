import React, { useState } from "react";
import Image from "next/image";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";
import Link from "next/link";
import IonIcon from "@reacticons/ionicons";
import { SignedMessage, SignedMessageWithProof } from "../lib/types";
import {
  verifyMessage,
  fetchMessage,
  generateNameFromPubkey,
  getLogoUrl,
  toggleLike,
  setMessageLiked,
  isMessageLiked,
  getPubkeyString,
} from "../lib/utils";

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
  const [likeCount, setLikeCount] = useState(message.likes || 0);
  const [isLiked, setIsLiked] = useState(isMessageLiked(message.id));

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
  const shouldRedirectToDomain =
    window.location.pathname !== `/${message.domain}`;
  const shouldRedirectToMessage =
    window.location.pathname !== `/messages/${message.id}`;

  async function onLikeClick() {
    try {
      const newIsLiked = !isLiked;
      setIsLiked(newIsLiked);
      setLikeCount((prev: number) => (newIsLiked ? prev + 1 : prev - 1));
      setMessageLiked(message.id, newIsLiked);
      await toggleLike(message.id, newIsLiked);
    } catch (error) {
      setIsLiked(isLiked);
      setLikeCount(likeCount);
      setMessageLiked(message.id, isLiked);
    }
  }

  function renderLogo() {
    if (isInternal) {
      return null;
    }

    if (shouldRedirectToDomain) {
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
          {shouldRedirectToDomain ? (
            <Link href={`/${message.domain}`}>{message.domain}</Link>
          ) : (
            <span>{message.domain}</span>
          )}

          {shouldRedirectToMessage ? (
            <Link href={`/messages/${message.id}`}>
              <span
                className="message-card-header-timestamp"
                title={timestamp.toLocaleString()}
              >
                {timeAgo.format(timestamp)}
              </span>
            </Link>
          ) : (
            <span
              className="message-card-header-timestamp"
              title={timestamp.toLocaleString()}
            >
              {timeAgo.format(timestamp)}
            </span>
          )}
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
              <span className="message-card-verify-icon valid">
                <IonIcon name="checkmark-outline" />
              </span>
            )}
            {verificationStatus === "invalid" && (
              <span className="message-card-verify-icon invalid">
                <IonIcon name="close-outline" />
              </span>
            )}
            {verificationStatus === "error" && (
              <span className="message-card-verify-icon error">
                <IonIcon name="alert-outline" />
              </span>
            )}
          </span>
        )}
      </header>

      <main className="message-card-content">{message.text}</main>

      <div className="message-card-footer">
        <div className="like-button-container">
          <button
            onClick={onLikeClick}
            disabled={!getPubkeyString()}
            className={`like-button ${isLiked ? "liked" : ""}`}
          >
            <IonIcon name={isLiked ? "heart" : "heart-outline"} />
            <span className="like-count">{likeCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageCard;
