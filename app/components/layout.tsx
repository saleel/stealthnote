import React from "react";
import Link from "next/link";

function Sidebar() {
  return (
    <header className="sidebar">
      <div className="logo">
        <Link href="/">StealthNote</Link>
      </div>
      <nav className="sidebar-nav">
        <Link href="/" className="sidebar-nav-item">
          Home
        </Link>
        <Link href="/aztecprotocol.com" className="sidebar-nav-item">
          My Company
        </Link>

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

export default Layout;
