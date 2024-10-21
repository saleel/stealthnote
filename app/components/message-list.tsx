"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchMessages } from "../lib/utils";
import MessageCard from "./message-card";
import { SignedMessage } from "../lib/types";
import Link from "next/link";

const MessageList: React.FC<{
  domain?: string;
  isInternal?: boolean;
  isCurrentDomain?: boolean;
}> = ({ domain, isInternal, isCurrentDomain }) => {
  const [messages, setMessages] = useState<SignedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const observer = useRef<IntersectionObserver | null>(null);

  const lastMessageElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const loadMessages = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const fetchedMessages = await fetchMessages(
        domain,
        isInternal,
        20,
        messages[messages.length - 1]?.timestamp
      );

      setMessages((prevMessages) => [...prevMessages, ...fetchedMessages]);
      setHasMore(fetchedMessages.length === 50);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, isInternal, page, loading, hasMore]);

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
    return (
      <div className="article text-center">
        <p className="title">No messages yet</p>
        <p className="mb-05">
          Are you a member of <span>{domain}</span>?
        </p>
        <p>
          Head over to the <Link href="/">homepage</Link> to send an anonymous
          message by proving you are a member of <span>{domain}</span>!
        </p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message, index) => (
        <div
          key={message.id || index}
          ref={index === messages.length - 1 ? lastMessageElementRef : null}
        >
          <MessageCard
            message={message}
            isCurrentDomain={isCurrentDomain}
            isInternal={isInternal}
          />
        </div>
      ))}
      {loading && renderLoading()}
      {!loading && messages.length === 0 && renderNoMessages()}
    </div>
  );
};

export default MessageList;
