"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchMessages } from "../lib/utils";
import MessageCard from "./message-card";
import { SignedMessage, SignedMessageWithProof } from "../lib/types";
import Link from "next/link";
import MessageForm from "./message-form";

const MESSAGES_PER_PAGE = 30;
const INITIAL_POLL_INTERVAL = 10000; // 10 seconds
const MAX_POLL_INTERVAL = 100000; // 100 seconds

const MessageList: React.FC<{
  domain?: string;
  isInternal?: boolean;
  showMessageForm?: boolean;
}> = ({ domain, isInternal, showMessageForm }) => {
  const [messages, setMessages] = useState<SignedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [pollInterval, setPollInterval] = useState(INITIAL_POLL_INTERVAL);

  const observer = useRef<IntersectionObserver | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(
    async (beforeTimestamp: number | null = null) => {
      if (isInternal && !domain) return;
      setLoading(true);

      try {
        const fetchedMessages = await fetchMessages(
          domain,
          isInternal,
          MESSAGES_PER_PAGE,
          beforeTimestamp
        );

        const existingMessageIds: Record<string, boolean> = {};
        messages.forEach((m) => {
          existingMessageIds[m.id] = true;
        });
        const cleanedMessages = fetchedMessages.filter(
          (m: SignedMessage) => !existingMessageIds[m.id]
        );

        setMessages((prevMessages) => [...prevMessages, ...cleanedMessages]);
        setHasMore(fetchedMessages.length === MESSAGES_PER_PAGE);
      } catch (error) {
        setError((error as Error)?.message);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domain, isInternal]
  );

  const lastMessageElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMessages(messages[messages.length - 1]?.timestamp);
        }
      });
      if (node) observer.current.observe(node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, loading, hasMore]
  );

  function onNewMessageSubmit(signedMessage: SignedMessageWithProof) {
    setMessages((prevMessages) => [signedMessage, ...prevMessages]);
  }

  const checkForNewMessages = useCallback(async () => {
    if (isInternal && !domain) return;

    try {
      const newMessages = await fetchMessages(
        domain,
        isInternal,
        MESSAGES_PER_PAGE,
        null,
        messages[0]?.timestamp
      );

      if (newMessages.length > 0) {
        setMessages((prevMessages) => [...newMessages, ...prevMessages]);
        setPollInterval(INITIAL_POLL_INTERVAL);
      } else {
        setPollInterval((prevInterval) =>
          Math.min(prevInterval + 10000, MAX_POLL_INTERVAL)
        );
      }
    } catch (error) {
      console.error("Error checking for new messages:", error);
    }
  }, [domain, isInternal, messages]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const startPolling = () => {
      intervalId = setInterval(() => {
        if (messageListRef.current && messageListRef.current.scrollTop === 0) {
          checkForNewMessages();
        }
      }, pollInterval);
    };

    startPolling();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollInterval, checkForNewMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  function renderLoading() {
    return (
      <div className="skeleton-loader">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="message-card-skeleton">
            <div className="message-card-skeleton-header">
              <div className="skeleton-text skeleton-short"></div>
            </div>
            <div className="skeleton-text skeleton-long mt-1"></div>
            <div className="skeleton-text skeleton-long mt-05"></div>
          </div>
        ))}
      </div>
    );
  }

  function renderNoMessages() {
    if (!domain) return null;

    return (
      <div className="article text-center">
        <p className="title">No messages yet</p>
        <p className="mb-05">
          Are you a member of <span>{domain}</span>?
        </p>
        {!isInternal ? (
          <p>
            Head over to the <Link href="/">homepage</Link> to send an anonymous
            message by proving you are a member of <span>{domain}</span>!
          </p>
        ) : (
          <p>
            No messages yet. Be the first one to send anonymous messages to your
            teammates.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {showMessageForm && (
        <MessageForm isInternal={isInternal} onSubmit={onNewMessageSubmit} />
      )}

      <div className="message-list" ref={messageListRef}>
        {messages.map((message, index) => (
        <div
          key={message.id || index}
          ref={index === messages.length - 1 ? lastMessageElementRef : null}
        >
          <MessageCard
            message={message}
            isInternal={isInternal}
          />
        </div>
      ))}
      {loading && renderLoading()}
        {!loading && !error && messages.length === 0 && renderNoMessages()}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </>
  );
};

export default MessageList;
