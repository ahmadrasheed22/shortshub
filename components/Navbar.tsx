"use client";

import Link from "next/link";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";

type NavbarProps = {
  syneFont: string;
};

export default function Navbar({ syneFont }: NavbarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <header className="navbar">
        <div className="page-container navbar-inner">
          <div className="navbar-brand-wrap">
            <button
              type="button"
              className="menu-btn"
              aria-label="Open menu"
              onClick={() => setIsSidebarOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>

            <Link href="/" className={`logo ${syneFont}`} aria-label="Trueclip home">
              <span className="logo-true">true</span>
              <span className="logo-clip">clip</span>
            </Link>
          </div>

          <nav className="navbar-links" aria-label="Primary">
            <Link href="/">Home</Link>
          </nav>
        </div>
      </header>
    </>
  );
}
