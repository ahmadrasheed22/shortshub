import Link from "next/link";

type NavbarProps = {
  syneFont: string;
};

export default function Navbar({ syneFont }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="page-container navbar-inner">
        <Link href="/" className={`logo ${syneFont}`} aria-label="Trueclip home">
          <span className="logo-true">true</span>
          <span className="logo-clip">clip</span>
        </Link>

        <nav className="navbar-links" aria-label="Primary">
          <Link href="/">Home</Link>
          <a href="https://github.com" target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
