'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import {
  Headphones,
  Mic,
  Camera,
  Music,
  BarChart3,
  Lightbulb,
  Newspaper,
} from 'lucide-react'
import Image from 'next/image'

const features = [
  {
    id: 'mnemonics',
    icon: Lightbulb,
    title: 'Mnemonics',
    subtitle: 'Learn Smarter',
    description:
      'Each kanji comes with clever mnemonics that break down radicals into easy-to-remember associations. No more rote memorization—just simple memory tricks that stick.',
    gradient: 'from-yellow-500 to-amber-500',
    screenshot: '/images/Mnemonic.png',
  },
  {
    id: 'listening',
    icon: Headphones,
    title: 'Listening Practice',
    subtitle: 'Train Your Ear',
    description:
      'Immerse yourself in real Japanese with authentic anime clips. Test your comprehension and build confidence in understanding spoken Japanese at natural speed.',
    gradient: 'from-purple-500 to-pink-500',
    screenshot: '/images/ListeningPractice.png',
  },
  {
    id: 'news',
    icon: Newspaper,
    title: 'NHK News',
    subtitle: 'Real-World Reading',
    description:
      'Read and listen to real Japanese news from NHK. Practice reading comprehension with current events written for Japanese learners at your level.',
    gradient: 'from-rose-500 to-pink-500',
    screenshot: '/images/NHKNews.png',
  },
  {
    id: 'speech',
    icon: Mic,
    title: 'Speech Recognition',
    subtitle: 'Perfect Your Pronunciation',
    description:
      'Speak Japanese and get instant feedback with real-time transcription. Practice speaking naturally and build confidence in your pronunciation skills.',
    gradient: 'from-green-500 to-emerald-500',
    screenshot: '/images/SpeechRecognition.png',
  },
  {
    id: 'music',
    icon: Music,
    title: 'Learn with Music',
    subtitle: 'Study with J-Pop',
    description:
      'Study with J-Pop and anime songs featuring perfectly synced lyrics. Learn vocabulary and grammar naturally through music you love.',
    gradient: 'from-orange-500 to-red-500',
    screenshot: '/images/SongLyrics.png',
  },
  {
    id: 'camera',
    icon: Camera,
    title: 'Camera OCR',
    subtitle: 'Instant Lookup',
    description:
      'Point your camera at any Japanese text to instantly look it up. Perfect for reading menus, signs, manga, and anything you encounter in the real world.',
    gradient: 'from-indigo-500 to-purple-500',
    screenshot: '/images/OCR.png',
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Advanced Analytics',
    subtitle: 'Track Progress',
    description:
      'Track your JLPT progress, view review heatmaps, and dive into detailed SRS statistics. Understand your learning patterns and optimize your study time.',
    gradient: 'from-teal-500 to-blue-500',
    screenshot: '/images/Analytics.png',
  },
]

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const activeFeature = features[activeIndex]

  return (
    <section id="features" className="relative py-16 md:py-32 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-sakura-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 md:mb-16"
        >
          <h2 className="section-title text-3xl md:text-4xl lg:text-5xl">
            Experience
            <br />
            <span className="gradient-text">Immersive Learning</span>
          </h2>
          <p className="section-subtitle text-sm md:text-base">
            Go beyond traditional flashcards with tools that make Japanese come alive.
          </p>
        </motion.div>

        {/* Feature selector tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-1.5 md:gap-3 mb-8 md:mb-16"
        >
          {features.map((feature, index) => (
            <motion.button
              key={feature.id}
              onClick={() => setActiveIndex(index)}
              className={`flex items-center gap-2 px-3 md:px-5 py-2 md:py-3 rounded-xl transition-colors duration-300 border ${
                activeIndex === index
                  ? 'bg-gradient-to-r ' + feature.gradient + ' text-white shadow-lg border-transparent'
                  : 'bg-white/5 backdrop-blur-sm border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <feature.icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="font-medium text-sm md:text-base hidden sm:inline">{feature.title}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Phone mockup with screenshot */}
          <motion.div
            key={activeFeature.id}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex justify-center"
          >
            {/* Glow */}
            <div
              className={`absolute inset-0 flex items-center justify-center blur-[100px] bg-gradient-to-br ${activeFeature.gradient} opacity-20`}
            />

            {/* Phone frame with screenshot */}
            <motion.div
              className="relative z-10"
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Phone frame - smaller on mobile */}
              <div className="relative w-[220px] h-[460px] md:w-[280px] md:h-[580px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[38px] md:rounded-[48px] p-2.5 md:p-3 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-3 md:top-4 left-1/2 -translate-x-1/2 w-[80px] md:w-[100px] h-[22px] md:h-[28px] bg-black rounded-full z-20" />

                {/* Screen */}
                <div className="w-full h-full rounded-[32px] md:rounded-[40px] overflow-hidden bg-black relative">
                  <Image
                    src={activeFeature.screenshot}
                    alt={activeFeature.title}
                    fill
                    className="object-cover object-top"
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Description */}
          <motion.div
            key={activeFeature.id + '-text'}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-left"
          >
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 lg:mb-6 bg-gradient-to-r ${activeFeature.gradient} bg-opacity-20`}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              }}
            >
              <activeFeature.icon className="w-4 h-4 text-white" />
              <span className="text-sm text-white">{activeFeature.subtitle}</span>
            </div>

            <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 lg:mb-6">{activeFeature.title}</h3>

            <p className="text-base lg:text-lg text-gray-400 mb-6 lg:mb-8 leading-relaxed">{activeFeature.description}</p>

            {/* Platform badge */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <motion.a
                href="#download"
                className="btn-primary inline-flex"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="relative z-10">Try It Free</span>
              </motion.a>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Available on iOS and Android
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
