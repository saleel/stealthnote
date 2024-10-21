import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchMessages } from "../lib/utils";
import MessageCard from "./message-card";
import { SignedMessage } from "../lib/types";

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
    console.log("loading messages", loading, hasMore);
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const fetchedMessages = await fetchMessages(
        domain,
        isInternal,
        50,
        messages[messages.length - 1]?.timestamp
      );

      setMessages((prevMessages) => [...prevMessages, ...fetchedMessages]);
      setHasMore(fetchedMessages.length === 50);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  useEffect(() => {
    loadMessages();
  }, []);

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
      {loading && (
        <div className="flex-center">
          <div className="spinner-icon"></div>
        </div>
      )}
    </div>
  );
};

export default MessageList;
