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
        </div>
      </div>
    </main>
  )
}
