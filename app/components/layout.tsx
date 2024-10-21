"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLocalStorage } from "@uidotdev/usehooks";

function Sidebar() {
  const [currentDomain] = useLocalStorage<string | null>(
    "currentDomain",
    null
  );

  return (
    <header className="sidebar">
      <div className="logo">
        <Link href="/">StealthNote</Link>
      </div>
      <nav className="sidebar-nav">
        <Link href="/" className="sidebar-nav-item">
          Home
        </Link>

        {currentDomain && (
          <Link
            href={`/internal/${currentDomain}`}
            className="sidebar-nav-item"
          >
            {currentDomain} Internal
          </Link>
        )}

        <div className="sidebar-nav-footer">
          <Link href="/how-it-works" className="sidebar-nav-item">
            How It Works
          </Link>
          <Link
            className="sidebar-nav-item"
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/saleel/stealthnote"
          >
            Github
          </Link>
        </div>
      </nav>
    </header>
  );
}

const Layout: React.FC = ({ children }) => {
  return (
    <div className="page">
      <Sidebar />
      <main className="container">
        <div className="content">{children}</div>
      </main>
    </div>
  );
};

const LayoutClient = dynamic(() => Promise.resolve(Layout), {
  ssr: false,
});

export default LayoutClient;