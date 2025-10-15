"use client"

import Link from "next/link"
import { Logomark } from "./components/Logomark"
import { Wordmark } from "./components/Wordmark"

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#000",
    color: "#F6F1EC",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center" as const,
  },
  wrapper: {
    width: "100%",
    maxWidth: "1200px",
    padding: "40px 24px 80px",
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
  },
  header: {
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    width: "100%",
    marginBottom: "80px",
  },
  brandLink: {
    color: "#F6F1EC",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center" as const,
    gap: "12px",
  },
  brandMark: {
    width: "140px",
    display: "block",
  },
  nav: {
    display: "flex",
    alignItems: "center" as const,
    gap: "16px",
  },
  secondaryButton: {
    color: "#F6F1EC",
    textDecoration: "none",
    padding: "10px 20px",
    borderRadius: "999px",
    border: "1px solid #2B2B2B",
    fontSize: "0.95rem",
    letterSpacing: "0.01em",
    transition: "background-color 0.2s ease, color 0.2s ease",
  },
  primaryButton: {
    color: "#070707",
    backgroundColor: "#F6F1EC",
    textDecoration: "none",
    padding: "10px 22px",
    borderRadius: "999px",
    fontSize: "0.95rem",
    letterSpacing: "0.01em",
  },
  hero: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    textAlign: "center" as const,
    gap: "32px",
  },
  logomark: {
    width: "180px",
    color: "#F6F1EC",
  },
  heading: {
    fontSize: "3rem",
    lineHeight: 1.1,
    fontWeight: 600,
    maxWidth: "600px",
  },
  blurb: {
    fontSize: "1.1rem",
    lineHeight: 1.6,
    maxWidth: "560px",
    color: "#B3B3B3",
  },
}

export default function Page() {
  return (
    <main style={styles.page}>
      <div style={styles.wrapper}>
        <header style={styles.header}>
          <Link href="/" style={styles.brandLink}>
            <div style={styles.brandMark}>
              <Wordmark />
            </div>
          </Link>
          <nav style={styles.nav}>
            <Link href="/docs" style={styles.secondaryButton}>
              Docs
            </Link>
            <Link href="/login" style={styles.primaryButton}>
              Log in or sign up
            </Link>
          </nav>
        </header>
        <section style={styles.hero}>
          <div style={styles.logomark}>
            <Logomark />
          </div>
          <h1 style={styles.heading}>Interactive audio stories in every genre</h1>
          <p style={styles.blurb}>
            Craft immersive tales that respond to every choice. Blend human creativity with adaptive soundscapes, living characters, and branching worlds that keep listeners engaged.
          </p>
        </section>
      </div>
    </main>
  )
}
