"use client";

import React from "react";
import Head from "next/head";
import MessageList from "../components/message-list";
import { getLogoUrl } from "../lib/utils";
import Image from "next/image";
import { useRouter } from "next/router";

// See messages from one domain
export default function DomainPage() {
  const domain = useRouter().query.domain as string;

  if (!domain) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Anonymous messages from members of {domain} - StealthNote</title>
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
            <div className="company-title">{domain}</div>
            <div className="company-description">
              Anonymous messages from members of {domain}
            </div>
          </div>
        </div>

        <MessageList domain={domain} showMessageForm={false} />
      </div>
    </>
  );
}
