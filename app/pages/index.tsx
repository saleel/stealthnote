import React, { useState, useEffect } from "react";
import { initProver, fetchMessages } from "../lib/utils";
import Head from "next/head";
import MessageCard from "../components/message-card";
import MessageForm from "../components/message-form";

export default function HomePage() {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    getMessages();
    initProver();
  }, []);

  async function getMessages() {
    try {
      const fetchedMessages = await fetchMessages();
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }

  return (
    <>
      <Head>
        <title>StealthNote</title>
      </Head>

      <div className="message-list">
        <MessageForm />

        {messages.map((message, index) => (
          <MessageCard key={index} message={message} />
        ))}
      </div>
    </>
  );
}
