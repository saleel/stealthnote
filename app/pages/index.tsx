"use client";

import React, { useState, useEffect } from "react";
import {
  generateKeyPairAndRegister,
  getDomain,
  initProver,
  isRegistered,
  fetchMessages,
} from "../lib/utils";
import Head from "next/head";
import SignInButton from "../components/siwg";
import { useRouter } from "next/navigation";
import MessageCard from "../components/message-card";
import MessageForm from "../components/message-form";

export default function HomePage() {
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState([]);
  const [userDomain, setUserDomain] = useState<string | null>(null);
  const router = useRouter();


  useEffect(() => {
    initProver();
    const domain = getDomain();
    if (domain) {
      setUserDomain(domain);
    }
    getMessages();
  }, []);

  async function getMessages() {
    try {
      const fetchedMessages = await fetchMessages();
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }

  async function handleSignIn(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    try {
      if (!isRegistered()) {
        await generateKeyPairAndRegister(setStatus);
      }
      const domain = getDomain();
      if (domain) {
        setUserDomain(domain);
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus(`Error: ${(error as Error).message}`);
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
