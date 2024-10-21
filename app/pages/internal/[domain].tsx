"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Message, SignedMessage } from "../../lib/types";
import { fetchMessages, signMessage, submitMessage } from "../../lib/utils";
import Head from "next/head";
import MessageCard from "../../components/message-card";

export default function DomainChatPage() {
  const params = useParams();
  const domain = params?.domain as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<SignedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const fetchInitialMessages = useCallback(async () => {
    if (!domain) return;

    setIsLoading(true);
    try {
      const fetchedMessages = await fetchMessages(domain, true, 50);
      setMessages(fetchedMessages.reverse()); // Reverse the order
      setHasMore(fetchedMessages.length === 50);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  const fetchNewMessages = useCallback(async () => {
    if (messages.length === 0 || !isAtBottom) return;
    const latestTimestamp = messages[messages.length - 1].timestamp; // Get the latest timestamp
    try {
      const newMessages = await fetchMessages(
        domain,
        true,
        50,
        latestTimestamp
      );
      if (newMessages.length > 0) {
        setMessages((prevMessages) => [
          ...prevMessages,
          ...newMessages.reverse(),
        ]); // Append new messages to the end
      }
    } catch (error) {
      console.error("Error fetching new messages:", error);
    }
  }, [domain, messages, isAtBottom]);

  useEffect(() => {
    const interval = setInterval(fetchNewMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchNewMessages]);

  const fetchPreviousMessages = useCallback(async () => {
    if (!hasMore || messages.length === 0) return;
    const oldestTimestamp = messages[0].timestamp; // Get the oldest timestamp
    setIsLoading(true);
    try {
      const olderMessages = await fetchMessages(
        domain,
        true,
        50,
        null,
        oldestTimestamp
      );
      if (olderMessages.length > 0) {
        setMessages((prevMessages) => [
          ...olderMessages.reverse(),
          ...prevMessages,
        ]); // Prepend older messages
        setHasMore(olderMessages.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching previous messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [domain, hasMore, messages]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          fetchPreviousMessages();
        }
      },
      { threshold: 1.0 }
    );

    if (messagesStartRef.current) {
      observer.observe(messagesStartRef.current);
    }

    return () => observer.disconnect();
  }, [fetchPreviousMessages, isLoading]);

  // Check if user is at bottom of message list
  const handleScroll = useCallback(() => {
    if (messageListRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 10);
    }
  }, []);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (messageList) {
      messageList.addEventListener("scroll", handleScroll);
      return () => messageList.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // Auto scroll to bottom when new messages arrive and user is at bottom
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAtBottom]);

  async function handleMessageSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await submitMessage(newMessage, domain, true);
      await fetchNewMessages();

      // Update message list
      setNewMessage("");
      setIsAtBottom(true); // Force scroll to bottom after sending a message
    } catch (error) {
      console.error(`Failed to submit message: ${(error as Error).stack}`);
    } finally {
      setIsSubmitting(false);
    }
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
      <div>
        <h1>
          Anonymous messages from members of{" "}
          <span>{domain}</span>
        </h1>

        <div className="message-list" ref={messageListRef}>
          {isLoading && messages.length === 0 && renderLoading()}
          {!isLoading && messages.length === 0 && renderNoMessages()}

          <div ref={messagesStartRef} />
          {messages.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="text-center" style={{ height: "60px" }}>
          {isLoading && <span className="spinner-icon small"></span>}
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              {/* <span>
                Sending as: {generateNameFromPubkey(getPubkeyString() || "")}
              </span> */}
              {/* <button
                type="button"
                onClick={() => generateKeyPairAndRegister()}
                className="update-name-button"
              >
                &#x21bb;
              </button> */}
            </div>
            <button
              type="submit"
              className={`message-input-button ${
                isSubmitting ? "loading" : ""
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? <span className="spinner-icon"></span> : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
