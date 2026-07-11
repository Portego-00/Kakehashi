'use client'

import { motion } from 'framer-motion'
import { ArrowDown, Smartphone, Star } from 'lucide-react'
import Image from 'next/image'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(250, 58, 125, 0.15) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(224, 100, 90, 0.1) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Floating Kanji */}
        <motion.span
          className="absolute top-20 left-10 text-8xl kanji-decoration"
          animate={{ y: [-10, 10, -10], rotate: [-5, 5, -5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >
          学
        </motion.span>
        <motion.span
          className="absolute top-40 right-20 text-7xl kanji-decoration"
          animate={{ y: [10, -10, 10], rotate: [5, -5, 5] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        >
          日
        </motion.span>
        <motion.span
          className="absolute bottom-40 left-20 text-9xl kanji-decoration"
          animate={{ y: [-15, 15, -15], rotate: [-3, 3, -3] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          本
        </motion.span>
        <motion.span
          className="absolute bottom-20 right-10 text-8xl kanji-decoration"
          animate={{ y: [15, -15, 15], rotate: [3, -3, 3] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          語
        </motion.span>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <Smartphone className="w-4 h-4 text-sakura-400" />
              <span className="text-sm text-gray-300">WaniKani Companion App</span>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Master Japanese
              <br />
              <span className="gradient-text">Your Way</span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-gray-400 mb-8 max-w-xl mx-auto lg:mx-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              The ultimate WaniKani companion with listening practice,
              speech recognition, and immersive learning through music
              and real Japanese content.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <motion.a
                href="#download"
                className="btn-primary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Download Free
                  <ArrowDown className="w-5 h-5" />
                </span>
              </motion.a>
              <motion.a
                href="#features"
                className="btn-secondary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Explore Features
              </motion.a>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="flex flex-wrap gap-4 md:gap-8 mt-8 md:mt-12 justify-center lg:justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">100%</div>
                <div className="text-xs md:text-sm text-gray-500">Free Forever</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">0</div>
                <div className="text-xs md:text-sm text-gray-500">Tracking or Ads</div>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 md:w-5 md:h-5 fill-sakura-400 text-sakura-400" />
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right - Phone Mockups */}
          <motion.div
            className="relative flex justify-center items-center"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          >
            {/* Glow behind phones */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[400px] h-[400px] rounded-full bg-sakura-500/20 blur-[120px]" />
            </div>

            {/* Phone stack container - hidden on mobile, shown on lg+ */}
            <div className="relative w-[500px] h-[520px] hidden lg:block">
              {/* Far back left phone */}
              <motion.div
                className="absolute -left-4 top-16 z-[5]"
                initial={{ opacity: 0, x: -40, rotate: -25 }}
                animate={{ opacity: 0.7, x: 0, rotate: -20, y: [-6, 6, -6] }}
                transition={{
                  opacity: { duration: 0.8, delay: 0.3 },
                  x: { duration: 0.8, delay: 0.3 },
                  rotate: { duration: 0.8, delay: 0.3 },
                  y: { duration: 7, repeat: Infinity, ease: 'easeInOut' }
                }}
              >
                <div className="relative w-[160px] h-[340px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[28px] p-1.5 shadow-lg">
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[55px] h-[16px] bg-black rounded-full z-20" />
                  <div className="w-full h-full rounded-[24px] overflow-hidden bg-black relative">
                    <Image
                      src="/images/NHKNews.png"
                      alt="NHK News"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Back left phone */}
              <motion.div
                className="absolute left-12 top-10 z-10"
                initial={{ opacity: 0, x: -30, rotate: -15 }}
                animate={{ opacity: 1, x: 0, rotate: -10, y: [-5, 5, -5] }}
                transition={{
                  opacity: { duration: 0.8, delay: 0.4 },
                  x: { duration: 0.8, delay: 0.4 },
                  rotate: { duration: 0.8, delay: 0.4 },
                  y: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }
                }}
              >
                <div className="relative w-[180px] h-[380px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[32px] p-2 shadow-xl">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[65px] h-[18px] bg-black rounded-full z-20" />
                  <div className="w-full h-full rounded-[26px] overflow-hidden bg-black relative">
                    <Image
                      src="/images/ListeningPractice.png"
                      alt="Listening Practice"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Back center-left phone (Song Lyrics) */}
              <motion.div
                className="absolute left-32 top-4 z-[18]"
                initial={{ opacity: 0, x: -20, rotate: -10 }}
                animate={{ opacity: 0.95, x: 0, rotate: -5, y: [-4, 4, -4] }}
                transition={{
                  opacity: { duration: 0.8, delay: 0.5 },
                  x: { duration: 0.8, delay: 0.5 },
                  rotate: { duration: 0.8, delay: 0.5 },
                  y: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }
                }}
              >
                <div className="relative w-[200px] h-[420px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[36px] p-2 shadow-2xl">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[75px] h-[20px] bg-black rounded-full z-20" />
                  <div className="w-full h-full rounded-[30px] overflow-hidden bg-black relative">
                    <Image
                      src="/images/SongLyrics.png"
                      alt="Song Lyrics"
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Front center phone (main) */}
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 top-0 z-20"
                animate={{ y: [-8, 8, -8] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="relative w-[220px] h-[460px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[38px] p-2.5 shadow-2xl">
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-black rounded-full z-20" />
                  <div className="w-full h-full rounded-[30px] overflow-hidden bg-black relative">
                    <Image
                      src="/images/Details.png"
                      alt="Kakehashi App"
                      fill
                      className="object-cover object-top"
                      priority
                    />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Mobile single phone - shown only on mobile */}
            <motion.div
              className="lg:hidden"
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="relative w-[200px] h-[420px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[36px] p-2 shadow-2xl mx-auto">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[70px] h-[20px] bg-black rounded-full z-20" />
                <div className="w-full h-full rounded-[30px] overflow-hidden bg-black relative">
                  <Image
                    src="/images/Details.png"
                    alt="Kakehashi App"
                    fill
                    className="object-cover object-top"
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-gray-600 flex justify-center pt-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-sakura-400"
            animate={{ y: [0, 12, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </section>
  )
}
