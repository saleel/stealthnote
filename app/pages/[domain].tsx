"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Message } from "../lib/types";
import {
  fetchMessage,
  fetchMessages,
  generateProof,
  // instantiateVerifier,
  signMessageWithGoogle,
  submitMessage,
  verifyProof,
} from "../lib/utils";
import usePromise from "../hooks/use-promise";

export default function DomainChatPage() {
  const params = useParams();
  const domain = params?.domain as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newMessage, setNewMessage] = useState("");
  const [isProving, setIsProving] = useState(false);
  const [status, setStatus] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<{
    [key: string]: "idle" | "verifying" | "valid" | "invalid";
  }>({});

  const [messages, { isFetching, error, reFetch, fetchedAt }] = usePromise<
    Message[]
  >(() => fetchMessages(domain), {
    defaultValue: [],
    dependencies: [domain],
  });

  // // Instantiate verifier on mount to make verification faster
  // useEffect(() => {
  //   instantiateVerifier();
  // }, []);

  // Automatically call refetch every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      reFetch();
    }, 10000);

    return () => clearInterval(interval);
  }, [reFetch]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleMessageSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    const message: Message = {
      id: crypto.randomUUID(),
      timestamp: new Date().getTime(),
      text: newMessage,
      sender: 123456,
      domain: domain,
    };

    try {
      setStatus("Sign in with Google to continue...");
      const { idToken, tokenPayload, headers } = await signMessageWithGoogle(
        message
      );
      message.kid = headers!.kid;
      console.log("Message signed with Google", { tokenPayload });

      setIsProving(true);
      setStatus("Generating proof. This will take 1-2 minutes...");

      const { proof, provingTime } = await generateProof(idToken!);
      console.log(`Proof generated in ${provingTime} ms`, proof);

      message.proof = proof;

      setStatus("Proof generated. Submitting message...");
      await submitMessage(message);

      // Update message list
      reFetch();
      setNewMessage("");
      
      setStatus("Message submitted!");

      setTimeout(() => {
        setStatus("");
      }, 3000);
    } catch (error) {
      console.error(`Failed to submit message: ${error}`);
      setStatus("Oops, something went wrong. Please try again.");
    } finally {
      setIsProving(false);
    }
  }

  async function onVerifyClick(messageId: string) {
    console.log("Verifying proof for message", messageId);
    setVerificationStatus((prev) => ({ ...prev, [messageId]: "verifying" }));

    try {
      const message = await fetchMessage(messageId);
      const { isValid, verificationTime } = await verifyProof(message);

      console.log(`Proof verified in ${verificationTime} ms`, isValid);
      setVerificationStatus((prev) => ({
        ...prev,
        [messageId]: isValid ? "valid" : "invalid",
      }));
    } catch (error) {
      console.error("Verification failed:", error);
      setVerificationStatus((prev) => ({ ...prev, [messageId]: "invalid" }));
    }
  }

  function renderMessage(message: Message, index: number) {
    const timestamp = new Date(message.timestamp);
    const status = verificationStatus[message.id] || "idle";

    return (
      <div key={message.timestamp} className="message-box">
        <div className="message-box-header">
          <span className="message-box-header-text">
            {`#${(index + 1).toString()} `}
          </span>
          <span className="message-box-header-text">
            <span>
              {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}
            </span>

            <span className={`message-box-verify ${status}`}>
              <button
                className={"message-box-verify-button"}
                onClick={() => onVerifyClick(message.id)}
                disabled={status === "verifying"}
                style={{ display: status === "idle" ? "inline" : "none" }}
              >
                {status === "idle" && "Verify"}
              </button>

              {status === "verifying" && (
                <span className="message-box-verify-icon spinner-icon small"></span>
              )}
              {status === "valid" && <span className="message-box-verify-icon valid">✓</span>}
              {status === "invalid" && <span className="message-box-verify-icon invalid">+</span>}
            </span>
          </span>
        </div>
        {message.text}
      </div>
    );
  }

  function renderLoading() {
    return (
      <div className="skeleton-loader">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="skeleton-message-box">
            <div className="skeleton-message-box-header">
              <div className="skeleton-text skeleton-short"></div>
            </div>
            <div className="skeleton-text skeleton-long"></div>
          </div>
        ))}
      </div>
    );
  }

  function renderNoMessages() {
    return (
      <div className="text-center">
        <p>No messages yet</p>
        <p>
          Be the first at <span>{domain}</span> to send a message!
        </p>
      </div>
    );
  }

  function renderStatusBox() {  
    return (
      <div className="status-box">
        {status && (
          <div className="status-box-message">{status}</div>
        )}
      </div>
    );
  }

  return (
    <div className="messages-container">
      <h1 className="messages-container-title">
        Anonymous messages from members of{" "}
        <span className="messages-container-title-domain">{domain}</span>
      </h1>

      <div className="message-list">
        {isFetching && !fetchedAt && renderLoading()}
        {fetchedAt && messages.length === 0 && renderNoMessages()}
        {!fetchedAt && error && <div>Error: {error.message}</div>}

        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleMessageSubmit}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your anonymous message..."
          className="message-input-field"
          disabled={isProving}
          rows={2}
        />
        <button
          type="submit"
          className={`message-input-button ${isProving ? "loading" : ""}`}
          disabled={isProving}
        >
          {isProving ? <span className="spinner-icon"></span> : "Submit"}
        </button>
      </form>

      {renderStatusBox()}

    </div>
  );
}
