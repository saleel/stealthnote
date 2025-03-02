"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLocalStorage } from "@uidotdev/usehooks";
import IonIcon from "@reacticons/ionicons";
import { LocalStorageKeys } from "../lib/types";
import { Providers } from "../lib/providers";
import { WelcomeModal } from './welcome-modal';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useLocalStorage<boolean>(
    LocalStorageKeys.DarkMode,
    false
  );
  const [currentGroupId] = useLocalStorage<string | null>(
    LocalStorageKeys.CurrentGroupId,
    null
  );
  const [currentProvider] = useLocalStorage<string | null>(
    LocalStorageKeys.CurrentProvider,
    null
  );
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  let slug = null;
  if (currentProvider && currentGroupId) {
    const provider = Providers[currentProvider];
    slug = provider.getSlug();
  }

  // Set dark mode
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <>
      <div className="page">
        <div className="mobile-header">
          <button
            className={`sidebar-toggle ${isSidebarOpen ? "open" : ""}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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
              <Link
                onClick={() => setIsSidebarOpen(false)}
                href="/"
                className="sidebar-nav-item"
              >
                Home
              </Link>

              {slug && (
                <Link
                  onClick={() => setIsSidebarOpen(false)}
                  href={`/${slug}/${currentGroupId}/internal`}
                  className="sidebar-nav-item"
                >
                  {currentGroupId} Internal
                </Link>
              )}
            </div>

            <div className="sidebar-nav-footer">
              <button
                onClick={() => {
                  setIsDark(!isDark);
                  setIsSidebarOpen(false);
                }}
                className="sidebar-nav-footer-item"
              >
                {isDark ? <IonIcon name="moon" /> : <IonIcon name="sunny" />}
              </button>
              <Link
                onClick={() => setIsSidebarOpen(false)}
                href="https://saleel.xyz/blog/stealthnote"
                target="_blank"
                rel="noopener noreferrer"
                title="How it works"
                className="sidebar-nav-footer-item"
              >
                <IonIcon name="reader" />
              </Link>
              <Link
                onClick={() => setIsSidebarOpen(false)}
                className="sidebar-nav-footer-item"
                target="_blank"
                title="Source Code"
                rel="noopener noreferrer"
                href="https://github.com/saleel/stealthnote"
              >
                <IonIcon name="logo-github" />
              </Link>
              <Link
                onClick={() => setIsSidebarOpen(false)}
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

      <WelcomeModal />
    </>
  );
};

const LayoutClient = dynamic(() => Promise.resolve(Layout), {
  ssr: false,
});

export default LayoutClient;
