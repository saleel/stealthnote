"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLocalStorage } from "@uidotdev/usehooks";

function Sidebar() {
  const [currentDomain] = useLocalStorage<string | null>(
    "currentDomain",
    null
  );

  return (
    <>
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
    </>
  );
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="page">
      <div className="mobile-header">
        <button className={`sidebar-toggle ${isSidebarOpen ? 'open' : ''}`} onClick={toggleSidebar}>
          ☰
        </button>
        <div
          className="mobile-header-logo"
          style={isSidebarOpen ? { display: "none" } : {}}
        >
          <Link href="/">StealthNote</Link>
        </div>
      </div>
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <Sidebar />
      </aside>
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
