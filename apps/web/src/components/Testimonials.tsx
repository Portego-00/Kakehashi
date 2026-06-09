'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah M.',
    level: 'Level 32',
    avatar: 'SM',
    text: "The listening practice feature is incredible. Hearing vocabulary in real anime context has helped my comprehension so much more than just flashcards alone.",
    rating: 5,
  },
  {
    name: 'Alex K.',
    level: 'Level 18',
    avatar: 'AK',
    text: "I love learning with music! Being able to see lyrics synced with songs I already enjoy has made studying feel less like work and more like fun.",
    rating: 5,
  },
  {
    name: 'Yuki T.',
    level: 'Level 45',
    avatar: 'YT',
    text: "The speech recognition is surprisingly accurate. It has helped me build confidence in actually speaking Japanese, not just reading and writing.",
    rating: 5,
  },
  {
    name: 'Emma L.',
    level: 'Level 12',
    avatar: 'EL',
    text: "Finally an app that does not track my data or show ads! It is refreshing to use something that just focuses on helping me learn.",
    rating: 5,
  },
  {
    name: 'James R.',
    level: 'Level 27',
    avatar: 'JR',
    text: "The NHK news feature is perfect for my level. I can actually read real Japanese articles without feeling completely lost.",
    rating: 5,
  },
  {
    name: 'Mika S.',
    level: 'Level 60',
    avatar: 'MS',
    text: "Even at level 60, the analytics and listening practice keep me engaged. This is the companion app WaniKani deserves.",
    rating: 5,
  },
]

interface Testimonial {
  name: string
  level: string
  avatar: string
  text: string
  rating: number
}

function TestimonialCard({ testimonial, index }: { testimonial: Testimonial; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="feature-card"
    >
      {/* Quote icon */}
      <Quote className="w-8 h-8 text-sakura-500/30 mb-4" />

      {/* Rating */}
      <div className="flex gap-1 mb-4">
        {[...Array(testimonial.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-sakura-400 text-sakura-400" />
        ))}
      </div>

      {/* Text */}
      <p className="text-gray-300 mb-6 leading-relaxed">{testimonial.text}</p>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sakura-500/20 to-primary-500/20 flex items-center justify-center text-2xl">
          {testimonial.avatar}
        </div>
        <div>
          <p className="font-semibold text-white">{testimonial.name}</p>
          <p className="text-sm text-gray-500">{testimonial.level}</p>
        </div>
      </div>
    </motion.div>
  )
}

export function Testimonials() {
  const headerRef = useRef(null)
  const isHeaderInView = useInView(headerRef, { once: true, margin: '-100px' })

  return (
    <section id="testimonials" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full bg-sakura-500/5 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="section-title">
            Loved by
            <br />
            <span className="gradient-text">Japanese Learners</span>
          </h2>
          <p className="section-subtitle">
            Join thousands of WaniKani users who have enhanced their learning journey.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={testimonial.name} testimonial={testimonial} index={index} />
          ))}
        </div>

        {/* Community stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { value: '10K+', label: 'Active Users' },
            { value: '4.9', label: 'App Store Rating' },
            { value: '500K+', label: 'Reviews Completed' },
            { value: '100%', label: 'Free Forever' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="text-center p-6 rounded-2xl glass"
            >
              <div className="text-3xl md:text-4xl font-bold gradient-text mb-2">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
