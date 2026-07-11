'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-400 mb-12">Last updated: January 20, 2026</p>

          <div className="prose prose-invert prose-gray max-w-none">
            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
              <p className="text-gray-400 leading-relaxed">
                Kakehashi is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights regarding your information.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Data We Collect</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Kakehashi collects and stores the following data locally on your device:
              </p>
              <ul className="space-y-3 text-gray-400">
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span><strong className="text-white">WaniKani API Token:</strong> Stored securely on your device to authenticate with WaniKani&apos;s servers. This token is never transmitted to any server other than WaniKani&apos;s official API.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span><strong className="text-white">App Settings:</strong> Your preferences such as review batch size, display options, and notification settings are stored locally on your device.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span><strong className="text-white">Cached WaniKani Data:</strong> Subject data (kanji, vocabulary, radicals) is cached locally to improve performance and enable offline access.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span><strong className="text-white">App Session Records:</strong> We may log basic app session information, such as user ID, username, level, app version, platform, and session time, to power usage streaks and understand app usage.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span><strong className="text-white">Optional Shared Features:</strong> If you submit feedback, feature requests, community posts, tips, or similar shared content, the information needed to provide that feature may be sent to Kakehashi&apos;s backend.</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Data We Do NOT Collect</h2>
              <ul className="space-y-3 text-gray-400">
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>We do not collect your WaniKani password or store your WaniKani API token on Kakehashi&apos;s backend</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>We do not use third-party analytics or tracking services</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>We do not transmit your core learning data to Kakehashi&apos;s backend unless you choose to use a server-backed feature</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>We do not share your data with third parties</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>We do not store your WaniKani password</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Third-Party Services</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Kakehashi connects to the following third-party services:
              </p>
              <ul className="space-y-3 text-gray-400">
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span><strong className="text-white">WaniKani API:</strong> To fetch your learning data and submit review results. Please refer to <a href="https://www.wanikani.com/privacy" target="_blank" rel="noopener noreferrer" className="text-sakura-400 hover:text-sakura-300">WaniKani&apos;s Privacy Policy</a> for information about how they handle your data.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span><strong className="text-white">Kakehashi API:</strong> To support usage streaks, optional server-backed features, and proxy secret-backed provider APIs without shipping provider keys in the app.</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Data Storage</h2>
              <p className="text-gray-400 leading-relaxed">
                Most app data is stored locally on your device using secure storage mechanisms provided by your operating system. Your API token is stored using secure device storage. Server-backed features store only the records needed to provide those features.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Data Deletion</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                You can delete all app data at any time by:
              </p>
              <ul className="space-y-3 text-gray-400">
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Logging out of the app (clears your API token and cached data)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-sakura-400">•</span>
                  <span>Uninstalling the app (removes all locally stored data)</span>
                </li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Children&apos;s Privacy</h2>
              <p className="text-gray-400 leading-relaxed">
                Kakehashi does not knowingly collect any personal information from children under 13.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Changes to This Policy</h2>
              <p className="text-gray-400 leading-relaxed">
                We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-white mb-4">Contact</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                If you have questions about this privacy policy, please contact us:
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
