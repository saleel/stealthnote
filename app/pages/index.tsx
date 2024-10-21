import React, { useEffect } from "react";
import { initProver } from "../lib/utils";
import Head from "next/head";
import MessageForm from "../components/message-form";
import MessageList from "../components/message-list";

export default function HomePage() {
  useEffect(() => {
    initProver();
  }, []);

  return (
    <>
      <Head>
        <title>StealthNote</title>
      </Head>

      <div className="home-page">
        <MessageForm />
        <MessageList />
      </div>
    </>
  );
}
