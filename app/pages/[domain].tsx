"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Message, SignedMessage, SignedMessageWithProof } from "../lib/types";
import {
  fetchMessage,
  fetchMessages,
  generateKeyPairAndRegister,
  isRegistered,
  signMessage,
  submitMessage,
  verifyMessage,
} from "../lib/utils";
import usePromise from "../hooks/use-promise";
import Head from "next/head";

export default function DomainChatPage() {
  const params = useParams();
  const domain = params?.domain as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    [key: string]: "idle" | "verifying" | "valid" | "invalid" | "error";
  }>({});

  const [messages, { isFetching, error, reFetch, fetchedAt }] = usePromise<
    Message[]
  >(() => fetchMessages(domain), {
    defaultValue: [],
    dependencies: [domain],
  });

  // Automatically call refetch every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      reFetch();
    }, 10_000);

    return () => clearInterval(interval);
  }, [reFetch]);

  // // Auto scroll to bottom when new messages arrive
  // useEffect(() => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [messages]);

  async function handleMessageSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    if (!isRegistered()) {
      console.log("Not registered. Generating key pair and registering.");
      await generateKeyPairAndRegister();
    }

    setIsSubmitting(true);

    const message: Message = {
      id: crypto.randomUUID(),
      timestamp: new Date().getTime(),
      text: newMessage,
      domain: domain,
    };

    try {
      console.log("Signing message", message);
      const { signatureHex, pubkey } = await signMessage(message);
      const signedMessage: SignedMessage = {
        ...message,
        signature: signatureHex,
        pubkey: pubkey as string,
      };

      console.log("Submitting message", signedMessage);
      await submitMessage(signedMessage);

      // Update message list
      reFetch();
      setNewMessage("");
    } catch (error) {
      console.error(`Failed to submit message: ${(error as Error).stack}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onVerifyClick(messageId: string) {
    setVerificationStatus((prev) => ({ ...prev, [messageId]: "verifying" }));

    try {
      const message = (await fetchMessage(messageId)) as SignedMessageWithProof;

      console.log("Verifying message", message);
      const isValid = await verifyMessage(message);

      setVerificationStatus((prev) => ({
        ...prev,
        [messageId]: isValid ? "valid" : "invalid",
      }));
    } catch (error) {
      console.error("Verification failed:", error);
      setVerificationStatus((prev) => ({ ...prev, [messageId]: "error" }));
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
              {status === "valid" && (
                <span className="message-box-verify-icon valid">✓</span>
              )}
              {status === "invalid" && (
                <span className="message-box-verify-icon invalid">+</span>
              )}
              {status === "error" && (
                <span className="message-box-verify-icon error">!</span>
              )}
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

  const title = `Anonymous messages from ${domain} - StealthNote`;

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
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

        <form
          className="message-input-container"
          onSubmit={handleMessageSubmit}
        >
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your anonymous message..."
            className="message-input-field"
            disabled={isSubmitting}
            rows={2}
          />
          <button
            type="submit"
            className={`message-input-button ${isSubmitting ? "loading" : ""}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="spinner-icon"></span> : "Submit"}
          </button>
        </form>
      </div>
    </>
  );
}
