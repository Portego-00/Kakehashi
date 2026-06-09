'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Link2, Zap, Rocket, CheckCircle2 } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Link2,
    title: 'Connect WaniKani',
    description:
      'Simply paste your WaniKani API token. Your data syncs instantly and stays up-to-date automatically.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '02',
    icon: Zap,
    title: 'Start Learning',
    description:
      'Complete reviews and lessons with enhanced UI. Use listening practice, speech recognition, and more.',
    color: 'from-sakura-500 to-pink-500',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Level Up Faster',
    description:
      'Track your progress with detailed analytics. Immerse yourself in Japanese through music and news.',
    color: 'from-purple-500 to-indigo-500',
  },
]

export function HowItWorks() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/2 left-0 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(250, 58, 125, 0.05) 0%, transparent 70%)',
          }}
          animate={{ x: [-100, 0, -100] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="section-title">
            Get Started in
            <br />
            <span className="gradient-text">Three Simple Steps</span>
          </h2>
          <p className="section-subtitle">
            Connect your WaniKani account and unlock a world of enhanced learning features.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="relative"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-full w-full h-px">
                  <motion.div
                    className="h-full bg-gradient-to-r from-gray-700 via-sakura-500/50 to-gray-700"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: index * 0.2 + 0.3 }}
                  />
                </div>
              )}

              <div className="relative p-8 rounded-3xl glass-strong text-center group hover:scale-105 transition-transform duration-300">
                {/* Step number */}
                <motion.div
                  className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r ${step.color} text-white text-sm font-bold`}
                  whileHover={{ scale: 1.1 }}
                >
                  {step.number}
                </motion.div>

                {/* Icon */}
                <div
                  className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}
                >
                  <step.icon className="w-10 h-10 text-white" />
                </div>

                <h3 className="text-2xl font-semibold text-white mb-4">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Benefits list */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 p-8 rounded-3xl gradient-border"
        >
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              'Works with free & paid WaniKani',
              'No separate account needed',
              'Instant sync with WaniKani',
              'Real-time progress tracking',
            ].map((benefit, index) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-sakura-400 flex-shrink-0" />
                <span className="text-gray-300">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
