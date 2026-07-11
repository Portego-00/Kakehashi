'use client'

import { motion, useInView, AnimatePresence } from 'framer-motion'
import { useRef, useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    question: 'Is Kakehashi really free?',
    answer:
      'Yes, Kakehashi is completely free to use with no hidden costs, subscriptions, or in-app purchases. All features are available to everyone. If you enjoy the app, you can support development through optional donations.',
  },
  {
    question: 'Do I need a WaniKani account?',
    answer:
      "Yes, you'll need a WaniKani account to use Kakehashi. The app syncs with your WaniKani data to provide personalized learning experiences. Both free and paid WaniKani accounts work with Kakehashi.",
  },
  {
    question: 'Is my data safe?',
    answer:
      "Absolutely. Kakehashi is privacy-first by design. We don't use third-party analytics tracking, your core learning data stays on your device and WaniKani, and your WaniKani API token is stored securely in your device's keychain. Usage streaks and optional shared features only send the data needed for those features.",
  },
  {
    question: 'Does it work offline?',
    answer:
      'Some features like search and viewing your data work offline. However, reviews and lessons require an internet connection to sync with WaniKani. Features like music streaming also require connectivity.',
  },
  {
    question: 'Is this an official WaniKani app?',
    answer:
      'No, Kakehashi is an unofficial community-built companion app. It is not affiliated with or endorsed by WaniKani or Tofugu. We simply love WaniKani and wanted to enhance the mobile learning experience.',
  },
  {
    question: 'What devices are supported?',
    answer:
      'Kakehashi is available for iPhone, iPad, and Android. We recommend iOS 26 or later for the best Apple device experience.',
  },
]

function FAQItem({ faq, index }: { faq: typeof faqs[0]; index: number }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="border-b border-gray-800"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="text-lg font-medium text-white group-hover:text-sakura-400 transition-colors">
          {faq.question}
        </span>
        <span className="ml-4 flex-shrink-0">
          {isOpen ? (
            <Minus className="w-5 h-5 text-sakura-400" />
          ) : (
            <Plus className="w-5 h-5 text-gray-500 group-hover:text-sakura-400 transition-colors" />
          )}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-gray-400 leading-relaxed">{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQ() {
  const headerRef = useRef(null)
  const isHeaderInView = useInView(headerRef, { once: true, margin: '-100px' })

  return (
    <section id="faq" className="relative py-32 overflow-hidden">
      <div className="max-w-3xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="section-title">
            Frequently Asked
            <br />
            <span className="gradient-text">Questions</span>
          </h2>
          <p className="section-subtitle">
            Everything you need to know about Kakehashi.
          </p>
        </motion.div>

        {/* FAQ List */}
        <div className="divide-y divide-gray-800 border-t border-gray-800">
          {faqs.map((faq, index) => (
            <FAQItem key={faq.question} faq={faq} index={index} />
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400 mb-4">Still have questions?</p>
          <a
            href="mailto:kakehashi.app@gmail.com"
            className="text-sakura-400 hover:text-sakura-300 font-medium transition-colors"
          >
            Contact us at kakehashi.app@gmail.com
          </a>
        </motion.div>
      </div>
    </section>
  )
}
