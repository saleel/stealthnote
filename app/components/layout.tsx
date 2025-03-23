"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useLocalStorage } from "@uidotdev/usehooks";
import IonIcon from "@reacticons/ionicons";
import { LocalStorageKeys } from "../lib/types";
import { Providers } from "../lib/providers";
import { WelcomeModal } from './welcome-modal';
import logo from "@/assets/logo.png";


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
  const [consoleShown, setConsoleShown] = React.useState(false);

  let slug = null;
  if (currentProvider && currentGroupId) {
    const provider = Providers[currentProvider];
    slug = provider.getSlug();
  }

  // Set dark mode
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  React.useEffect(() => {
    if (consoleShown) {
      return;
    }

    console.log(
      '%c📝 If you run in to any errors, please create an issue at https://github.com/saleel/stealthnote/issues\n' +
      '🐦 You can also reach out to me on Twitter at https://twitter.com/_saleel',
      'background: #efefef; color: black; font-size: 16px; padding: 10px; border-radius: 3px;'
    );
    setConsoleShown(true);
  }, [consoleShown]);

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
            <Link href="/">
              <Image src={logo} alt="StealthNote" width={150} height={50} />
            </Link>
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
                href="https://saleel.xyz/blog/stealthnote/"
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
                href="https://x.com/stealthnote_"
                target="_blank"
                rel="noopener noreferrer"
                title="Twitter"
                className="sidebar-nav-footer-item"
              >
                <IonIcon name="logo-twitter" />
              </Link>
            </div>
          </nav>

          <p className="sidebar-nav-copyright">
            <span>Made with </span>
            <Link 
              href="https://noir-lang.org" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: '#382E81' }}
            >
              Noir
            </Link>
            <span> ❤️ </span>
          </p>
          <div className="sidebar-nav-footer-links">
            <Link
              href="/disclaimer"
            >
              Disclaimer
            </Link>
            <Link
              href="/privacy"
            >
              Privacy Policy
            </Link>
          </div>
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
