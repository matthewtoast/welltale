"use client"

import Link from "next/link"
import { Logomark } from "./components/Logomark"
import { Wordmark } from "./components/Wordmark"

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '1280px', padding: '80px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
          <div style={{ color: "#F6F1EC", width: '200px' }}>
            <Logomark />
          </div>
          <div style={{ color: "#F6F1EC", width: '400px' }}>
            <Wordmark />
          </div>
          <Link 
            href="/docs" 
            style={{ 
              color: '#4a9eff', 
              textDecoration: 'none',
              fontSize: '1.2rem',
              padding: '12px 24px',
              border: '1px solid #4a9eff',
              borderRadius: '8px',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-sans)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4a9eff';
              e.currentTarget.style.color = '#000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#4a9eff';
            }}
          >
            📖 Story Creator Guide
          </Link>
        </div>
      </div>
    </main>
  )
}
