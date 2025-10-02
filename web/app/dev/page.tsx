import Link from 'next/link'

const components = [
  { name: 'Col', path: '/dev/Col' },
  { name: 'Row', path: '/dev/Row' },
  { name: 'View', path: '/dev/View' },
  { name: 'Logomark', path: '/dev/Logomark' },
  { name: 'Wordmark', path: '/dev/Wordmark' },
  { name: 'StoryPlayerUI', path: '/dev/StoryPlayerUI' },
]

export default function DevPage() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '32px' }}>Component Viewer</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {components.map((component) => (
          <Link
            key={component.name}
            href={component.path}
            style={{ 
              display: 'block', 
              padding: '24px', 
              border: '1px solid #e5e5e5', 
              borderRadius: '8px', 
              textDecoration: 'none',
              color: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#d4d4d4';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e5e5';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{component.name}</h2>
            <p style={{ color: '#525252', marginTop: '8px' }}>View component variations</p>
          </Link>
        ))}
      </div>
    </div>
  )
}