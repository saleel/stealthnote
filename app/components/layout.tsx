"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLocalStorage } from "@uidotdev/usehooks";
import IonIcon from "@reacticons/ionicons";
import { isDarkMode, setDarkMode } from "../lib/utils";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentDomain] = useLocalStorage<string | null>("currentDomain", null);

  const [isDark, setIsDark] = React.useState(isDarkMode());
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    setDarkMode(!isDark);
  };

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <div className="page">
      <div className="mobile-header">
        <button
          className={`sidebar-toggle ${isSidebarOpen ? "open" : ""}`}
          onClick={toggleSidebar}
        >
          ☰
        </button>
        <div
          className="mobile-header-logo"
          style={isSidebarOpen ? { display: "none" } : {}}
        >
          <Link href="/">StealthNote</Link>
        </div>
      </div>
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="logo">
          <Link href="/">StealthNote</Link>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-header">
            <Link onClick={toggleSidebar} href="/" className="sidebar-nav-item">
              Home
            </Link>

            {currentDomain && (
              <Link
                onClick={toggleSidebar}
                href={`/internal/${currentDomain}`}
                className="sidebar-nav-item"
              >
                {currentDomain} Internal
              </Link>
            )}
          </div>

          <div className="sidebar-nav-footer">
            <button
              onClick={() => {
                toggleSidebar();
                toggleDarkMode();
              }}
              className="sidebar-nav-footer-item"
            >
              {isDark ? (
                <IonIcon name="moon" />
              ) : (
                <IonIcon name="sunny" />
              )}
            </button>
            <Link
              onClick={toggleSidebar}
              href="https://saleel.xyz/blog/stealthnote"
              target="_blank"
              rel="noopener noreferrer"
              title="How it works"
              className="sidebar-nav-footer-item"
            >
              <IonIcon name="reader" />
            </Link>
            <Link
              onClick={toggleSidebar}
              className="sidebar-nav-footer-item"
              target="_blank"
              title="Source Code"
              rel="noopener noreferrer"
              href="https://github.com/saleel/stealthnote"
            >
              <IonIcon name="logo-github" />
            </Link>
            <Link
              onClick={toggleSidebar}
              href="https://x.com/_saleel"
              target="_blank"
              rel="noopener noreferrer"
              title="Twitter"
              className="sidebar-nav-footer-item"
            >
              <IonIcon name="logo-twitter" />
            </Link>
          </div>
        </nav>
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
