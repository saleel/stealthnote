"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";

interface Message {
  text: string;
  sender: string;
  timestamp: number;
}

export default function ChatPage() {
  const params = useParams();
  const domain = params.domain as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      timestamp: 1726318347308,
      text: "Hello! How can I help you today?",
      sender: "bot",
    },
    {
      timestamp: 1726318147308,
      text: "I have a question about your services.",
      sender: "user",
    },
    {
      timestamp: 1726318447308,
      text: "Sure, I'd be happy to help. What would you like to know?",
      sender: "bot",
    },
  ]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleMessageSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newMessage.trim()) {
      setMessages([
        ...messages,
        { timestamp: new Date().getTime(), text: newMessage, sender: "user" },
      ]);
      setNewMessage("");
    }
  }

  function renderMessage(message: Message) {
    return (
      <div key={message.timestamp} className={`message-box ${message.sender}`}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="message-box-sender">{message.sender}</span>
          <span className="message-box-timestamp">
            {new Date(message.timestamp).toLocaleDateString()}{" "}
            {new Date(message.timestamp).toLocaleTimeString()}
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
        {messages.map((message) => renderMessage(message))}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-container" onSubmit={handleMessageSubmit} >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your anonymous message..."
          className="message-input-field"
        />
        <button type="submit" className="message-input-button">
          Submit
        </button>
      </form>
    </div>
  );
}
