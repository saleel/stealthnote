"use client";

import React from "react";
import Link from "next/link";
import "./styles.scss";

import "cal-sans";

function Header() {
  return (
    <header className="navbar">
      <div className="logo">
        <Link href="/">AnonChat</Link>
      </div>
      <nav>
        <Link className="nav-link" href="/how-it-works">
          How It Works
        </Link>
        <Link
          className="nav-link"
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/saleel/anon-chat"
        >
          Github
        </Link>
      </nav>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
