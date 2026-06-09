'use client'

import { motion } from 'framer-motion'
import { Mail, Heart } from 'lucide-react'
import Image from 'next/image'

const footerLinks = {
  Product: [
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
  ],
  Legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
  ],
  Support: [
    { name: 'Contact', href: 'mailto:kakehashi.app@gmail.com' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Report Issue', href: 'mailto:kakehashi.app@gmail.com?subject=Bug%20Report' },
  ],
}

const socialLinks = [
  { icon: Mail, href: 'mailto:kakehashi.app@gmail.com', label: 'Email' },
]

export function Footer() {
  return (
    <footer className="relative pt-20 pb-10 overflow-hidden">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <motion.a
              href="#"
              className="flex items-center gap-3 mb-6"
              whileHover={{ scale: 1.02 }}
            >
              <Image
                src="/images/app-icon.png"
                alt="Kakehashi"
                width={40}
                height={40}
                className="rounded-xl"
              />
              <span className="text-xl font-bold text-white">Kakehashi</span>
            </motion.a>
            <p className="text-gray-400 mb-6 max-w-sm">
              The ultimate WaniKani companion app. Master Japanese with listening practice,
              speech recognition, and immersive learning.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  className="w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white hover:bg-sakura-500/20 transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-white font-semibold mb-4">{title}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Kakehashi. All rights reserved.
            </p>
            <p className="text-gray-500 text-sm flex items-center gap-1">
              Made with <Heart className="w-4 h-4 text-sakura-500 fill-sakura-500" /> for Japanese learners
            </p>
            <p className="text-gray-600 text-xs">
              Not affiliated with WaniKani or Tofugu
            </p>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-sakura-500/20 to-transparent" />
    </footer>
  )
}
