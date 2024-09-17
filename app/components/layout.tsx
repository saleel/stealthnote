import React from "react";
import Link from "next/link";

function Header() {
  return (
    <header className="navbar">
      <div className="logo">
        <Link href="/">AnonChat</Link>
      </div>
      <nav>
        <Link href="/how-it-works" className="nav-link">
          How It Works
        </Link>
        <a
          className="nav-link"
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/saleel/anon-chat"
        >
          Github
        </a>
      </nav>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="container">{children}</div>
    </>
  )
}