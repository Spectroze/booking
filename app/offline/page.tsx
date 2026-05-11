'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfflinePage() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect when connection is restored
    const handleOnline = () => router.push('/');
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#e2e8f0',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '420px',
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '1.5rem',
          padding: '3rem 2rem',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {/* Wi-Fi off icon */}
        <div
          style={{
            width: 96,
            height: 96,
            margin: '0 auto 1.5rem',
            background: 'rgba(30,58,95,0.6)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(99,179,237,0.3)',
          }}
        >
          <svg
            width="48"
            height="48"
            fill="none"
            stroke="#63b3ed"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <circle cx="12" cy="20" r="1" fill="#63b3ed" stroke="none" />
          </svg>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
          You&apos;re Offline
        </h1>
        <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2rem' }}>
          It looks like you&apos;ve lost your internet connection. We&apos;ll reconnect you automatically when you&apos;re back online.
        </p>

        <div
          style={{
            background: 'rgba(99,179,237,0.08)',
            border: '1px solid rgba(99,179,237,0.2)',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            textAlign: 'left',
            marginBottom: '1.5rem',
          }}
        >
          <p style={{ fontSize: '0.8rem', color: '#7dd3fc', fontWeight: 600, marginBottom: '0.5rem' }}>
            Try these steps:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[
              'Check your Wi-Fi or mobile data connection',
              'Toggle Airplane mode off and on',
              'Move closer to your router',
            ].map((tip) => (
              <li key={tip} style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.2rem 0 0.2rem 1rem', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, color: '#63b3ed' }}>›</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: '0.875rem 1.5rem',
            background: 'linear-gradient(135deg, #1d4ed8, #1e3a5f)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
