import React, { useState } from "react";
import { Message, SignedMessageWithProof } from "../lib/types";
import { verifyMessage, fetchMessage } from "../lib/utils";

interface MessageCardProps {
  message: Message;
}

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

  return (
    <div className="message-box">
      <div className="message-box-header">
        <span className="message-box-header-text" style={{ flexGrow: 1 }}>
          Someone from {message.domain} said:
        </span>
        <span className="message-box-header-text">
          {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}
        </span>

        {verificationStatus === "idle" && (
          <span className="message-box-verify-button" onClick={onVerify}>
            {verificationStatus === "idle" && "Verify"}
          </span>
        )}

        {verificationStatus !== "idle" && (
          <span className={`message-box-verify ${verificationStatus}`}>
            {verificationStatus === "verifying" && (
            <span className="message-box-verify-icon spinner-icon small"></span>
          )}
          {verificationStatus === "valid" && (
            <span className="message-box-verify-icon valid">✓</span>
          )}
          {verificationStatus === "invalid" && (
            <span className="message-box-verify-icon invalid">+</span>
          )}
          {verificationStatus === "error" && (
            <span className="message-box-verify-icon error">!</span>
            )}
          </span>
        )}
      </div>
      {message.text}
    </div>
  );
};

export default MessageCard;
