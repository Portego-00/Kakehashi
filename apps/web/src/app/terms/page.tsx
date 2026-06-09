'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-dark-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-white/10 py-4">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/app-icon.png"
              alt="Kakehashi"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-bold text-white">Kakehashi</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-gray-400 mb-12">Last updated: January 20, 2026</p>

          <div className="prose prose-invert prose-gray max-w-none">
            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-400 leading-relaxed">
                By downloading, installing, or using Kakehashi (&quot;the App&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-gray-400 leading-relaxed">
                Kakehashi is a companion app for WaniKani that provides additional study features including listening practice, speech recognition, music-based learning, and enhanced review interfaces. The App requires a valid WaniKani account to function.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">3. WaniKani Account</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                To use Kakehashi, you must have an active WaniKani account. You are responsible for:
              </p>
              <ul className="space-y-3 text-gray-400">
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Maintaining the security of your WaniKani API token</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Complying with WaniKani&apos;s Terms of Service</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Any activity that occurs through your account</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">4. Unofficial App</h2>
              <p className="text-gray-400 leading-relaxed">
                Kakehashi is an unofficial, community-built app. It is not affiliated with, endorsed by, or connected to WaniKani or Tofugu LLC. WaniKani is a registered trademark of Tofugu LLC.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">5. Free Service</h2>
              <p className="text-gray-400 leading-relaxed">
                Kakehashi is provided free of charge. There are no hidden fees, subscriptions, or in-app purchases. Optional donations to support development may be accepted but are not required.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">6. Acceptable Use</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="space-y-3 text-gray-400">
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Use the App for any unlawful purpose</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Attempt to reverse engineer, decompile, or disassemble the App</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Use the App to violate WaniKani&apos;s Terms of Service</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Distribute or share your API token with others</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">7. Disclaimer of Warranties</h2>
              <p className="text-gray-400 leading-relaxed">
                The App is provided &quot;as is&quot; without warranty of any kind, express or implied. We do not guarantee that the App will be error-free, uninterrupted, or compatible with all devices. Your use of the App is at your own risk.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">8. Limitation of Liability</h2>
              <p className="text-gray-400 leading-relaxed">
                To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">9. Changes to Terms</h2>
              <p className="text-gray-400 leading-relaxed">
                We reserve the right to modify these terms at any time. Changes will be posted on this page with an updated revision date. Continued use of the App after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">10. Termination</h2>
              <p className="text-gray-400 leading-relaxed">
                You may stop using the App at any time by uninstalling it. We reserve the right to discontinue the App at any time without notice.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">11. Contact</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                If you have questions about these terms, please contact us:
              </p>
              <a
                href="mailto:kakehashi.app@gmail.com"
                className="text-sakura-400 hover:text-sakura-300 transition-colors"
              >
                kakehashi.app@gmail.com
              </a>
            </section>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-gray-500 text-sm">
            Kakehashi is not affiliated with WaniKani or Tofugu LLC.
          </p>
        </div>
      </footer>
    </main>
  )
}
