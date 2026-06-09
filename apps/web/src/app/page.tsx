'use client'

import {
  Navigation,
  Hero,
  Features,
  HowItWorks,
  // Showcase, // Features now includes the phone mockup
  // Testimonials,
  FAQ,
  Download,
  Footer,
} from '@/components'

export default function Home() {
  return (
    <main className="relative min-h-screen bg-dark-950">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Showcase Section - merged into Features */}
      {/* <Showcase /> */}

      {/* Testimonials Section - Uncomment when testimonials are available */}
      {/* <Testimonials /> */}

      {/* FAQ Section */}
      <FAQ />

      {/* Download CTA Section */}
      <Download />

      {/* Footer */}
      <Footer />
    </main>
  )
}
