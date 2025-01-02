"use client";

import React from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useLocalStorage } from "@uidotdev/usehooks";
import MessageList from "../../components/message-list";
import { ProviderSlugKeyMap } from "../../lib/providers";

// See messages from one anon group
export default function GroupPage() {
  const [currentGroupId] = useLocalStorage<string | null>(
    "currentGroupId",
    null
  );

  const groupId = useRouter().query.groupId as string;
  const slug = useRouter().query.slug as string;

  if (!groupId || !slug) {
    return null;
  }

  const provider = ProviderSlugKeyMap[slug];
  const anonGroup = provider.getAnonGroup(groupId);

  return (
    <>
      <Head>
        <title>Anonymous messages from members of {groupId} - StealthNote</title>
      </Head>

      <div className="domain-page">
        <div className="company-info">
          <div className="company-logo">
            <Image
              src={anonGroup.logoUrl}
              alt={anonGroup.title}
              width={50}
              height={50}
            />
          </div>
          <div>
            <div className="company-title">{anonGroup.title}</div>
            <div className="company-description">
              Anonymous messages from members of {anonGroup.title}
            </div>
          </div>
        </div>

        <MessageList
          groupId={groupId}
          showMessageForm={currentGroupId == groupId}
        />
      </div>
    </>
  );
}
