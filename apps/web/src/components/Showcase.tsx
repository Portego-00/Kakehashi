'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { BookOpen, CheckCircle, GraduationCap, Smartphone } from 'lucide-react'
import Image from 'next/image'

const showcaseItems = [
  {
    id: 'reviews',
    title: 'Reviews',
    subtitle: 'Master Your Kanji',
    description:
      'Complete your WaniKani reviews with a beautiful, optimized mobile interface. Get instant feedback and track your progress in real-time.',
    icon: BookOpen,
    gradient: 'from-purple-500 to-pink-500',
    screenshot: '/images/Reviews.png',
  },
  {
    id: 'lessons',
    title: 'Lessons',
    subtitle: 'Learn New Items',
    description:
      'Study new radicals, kanji, and vocabulary with detailed explanations, mnemonics, and example sentences. Learn at your own pace.',
    icon: GraduationCap,
    gradient: 'from-blue-500 to-cyan-500',
    screenshot: '/images/Lessons.png',
  },
  {
    id: 'complete',
    title: 'Track Progress',
    subtitle: 'Celebrate Success',
    description:
      'See your progress after each session. Track items burned, accuracy rates, and celebrate your achievements as you level up.',
    icon: CheckCircle,
    gradient: 'from-green-500 to-emerald-500',
    screenshot: '/images/ReviewsFinished.png',
  },
  {
    id: 'login',
    title: 'Easy Setup',
    subtitle: 'Quick Start',
    description:
      'Connect your WaniKani account in seconds. Just paste your API token and start learning immediately with all your data synced.',
    icon: Smartphone,
    gradient: 'from-orange-500 to-red-500',
    screenshot: '/images/login.png',
  },
]

export function Showcase() {
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const activeItem = showcaseItems[activeIndex]

  return (
    <section className="relative py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="section-title">
            Experience
            <br />
            <span className="gradient-text">Immersive Learning</span>
          </h2>
          <p className="section-subtitle">
            Go beyond traditional flashcards with tools that make Japanese come alive.
          </p>
        </motion.div>

        {/* Tab selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3 mb-16"
        >
          {showcaseItems.map((item, index) => (
            <motion.button
              key={item.id}
              onClick={() => setActiveIndex(index)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-300 ${
                activeIndex === index
                  ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-lg'
                  : 'glass text-gray-400 hover:text-white'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.title}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Phone mockup with screenshot */}
          <motion.div
            key={activeItem.id}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex justify-center order-2 lg:order-1"
          >
            {/* Glow */}
            <div
              className={`absolute inset-0 flex items-center justify-center blur-[100px] bg-gradient-to-br ${activeItem.gradient} opacity-20`}
            />

            {/* Phone frame with screenshot */}
            <motion.div
              className="relative z-10"
              animate={{ y: [-5, 5, -5] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Phone frame */}
              <div className="relative w-[280px] h-[580px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[48px] p-3 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-20" />

                {/* Screen */}
                <div className="w-full h-full rounded-[40px] overflow-hidden bg-black relative">
                  <Image
                    src={activeItem.screenshot}
                    alt={activeItem.title}
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
            key={activeItem.id + '-text'}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center lg:text-left order-1 lg:order-2"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              }}
            >
              <activeItem.icon className="w-4 h-4 text-white" />
              <span className="text-sm text-white">{activeItem.subtitle}</span>
            </div>

            <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">{activeItem.title}</h3>

            <p className="text-lg text-gray-400 mb-8 leading-relaxed">{activeItem.description}</p>

            <motion.a
              href="#download"
              className="btn-primary inline-flex"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">Try It Free</span>
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
