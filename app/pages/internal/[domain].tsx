"use client";

import React from "react";
import Head from "next/head";
import MessageList from "../../components/message-list";
import { getLogoUrl } from "../../lib/utils";
import Image from "next/image";
import router, { useRouter } from "next/router";
import { useLocalStorage } from "@uidotdev/usehooks";

export default function InternalMessagesPage() {
  const domain = useRouter().query.domain as string;

  const [currentDomain] = useLocalStorage("currentDomain",null);

  if (!domain) {
    return null;
  }

  if (domain !== currentDomain) {
    router.push(`/`);
  }

  return (
    <>
      <Head>
        <title>Internal messages from members of {domain} - StealthNote</title>
      </Head>

      <div className="domain-page">
        <div className="company-info">
          <div className="company-logo">
            <Image
              src={getLogoUrl(domain)}
              alt={domain}
              width={50}
              height={50}
            />
          </div>
          <div>
            <div className="company-title">{domain} Internal</div>
            <div className="company-description">
              Messages sent here are only visible to members of {domain}
            </div>
          </div>
        </div>

        <MessageList domain={domain} isInternal showMessageForm />
      </div>
    </>
  );
}
