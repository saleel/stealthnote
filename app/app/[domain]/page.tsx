"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Message } from "../types";
import {
  fetchMessage,
  fetchMessages,
  generateProof,
  signMessageWithGoogle,
  submitMessage,
  verifyProof,
} from "../utils";
import usePromise from "../hooks/use-promise";

export default function ChatPage() {
  const params = useParams();
  const domain = params.domain as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [newMessage, setNewMessage] = useState("");
  const [isProving, setIsProving] = useState(false);

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
      timestamp: new Date().toISOString(),
      text: newMessage,
      sender: 123456,
      domain: domain,
    };

    try {
      const { idToken, tokenPayload } = await signMessageWithGoogle(message);
      console.log("Message signed with Google", { tokenPayload });

      setIsProving(true);
      const { proof, provingTime } = await generateProof(idToken!);
      console.log(`Proof generated in ${provingTime} ms`, proof);

      await submitMessage(message, proof);
      reFetch();
      setNewMessage("");
    } catch (error) {
      console.error(`Failed to submit message: ${error}`);
      alert('Oops, something went wrong. Please try again.');
    } finally {
      setIsProving(false);
    }
  }

  async function onVerifyClick(messageId: string) {
    console.log("Verifying proof");

    // Fetch single message with proof
    const message = await fetchMessage(messageId);
    
    // Prepare full proof object
    const { isValid, verificationTime } = await verifyProof(message, domain, message.proof);

    if (!isValid) {
      alert("Proof is invalid");
    }

    // Verify proof
    console.log(`Proof verified in ${verificationTime} ms`, isValid); 
  }

  function renderMessage(message: Message) {
    return (
      <div key={message.timestamp} className={`message-box ${message.sender}`}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="message-box-sender">{message.sender}</span>
          <span className="message-box-timestamp">
            {new Date(message.timestamp).toLocaleDateString()}{" "}
            {new Date(message.timestamp).toLocaleTimeString()}

            <button className="message-box-verify" onClick={() => onVerifyClick(message.id)}>Verify</button>
          </span>
        </div>
        {message.text}
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
        {isFetching && !fetchedAt && (
          <div className="text-center">Loading...</div>
        )}
        {fetchedAt && messages.length === 0 && (
          <div className="text-center">No messages yet</div>
        )}
        {error && <div>Error: {error.message}</div>}

        {messages.map((message) => renderMessage(message))}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleMessageSubmit}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your anonymous message..."
          className="message-input-field"
          disabled={isProving}
        />
        <button
          type="submit"
          className="message-input-button"
          disabled={isProving}
        >
          {isProving ? "Proving..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
