import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kakehashi - Your Japanese Learning Companion',
  description: 'The ultimate WaniKani companion app. Master Japanese with listening practice, speech recognition, music lyrics, and more.',
  keywords: ['Japanese', 'WaniKani', 'Kanji', 'Learning', 'App', 'iOS', 'Android', 'Study'],
  authors: [{ name: 'Kakehashi' }],
  openGraph: {
    title: 'Kakehashi - Your Japanese Learning Companion',
    description: 'The ultimate WaniKani companion app with immersive learning tools.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kakehashi - Your Japanese Learning Companion',
    description: 'The ultimate WaniKani companion app with immersive learning tools.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  )
}
