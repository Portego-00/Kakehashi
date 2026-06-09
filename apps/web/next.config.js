const path = require('path')
const fs = require('fs')

loadMonorepoRootEnv()

const youtubeApiKey =
  process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ||
  process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ||
  ''
const youtubeApiBaseUrl =
  process.env.NEXT_PUBLIC_YOUTUBE_API_BASE_URL ||
  process.env.EXPO_PUBLIC_YOUTUBE_API_BASE_URL ||
  ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  env: {
    NEXT_PUBLIC_YOUTUBE_API_BASE_URL: youtubeApiBaseUrl,
    NEXT_PUBLIC_YOUTUBE_API_KEY: youtubeApiKey,
  },
  transpilePackages: ['@kakehashi/core'],
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig

function loadMonorepoRootEnv() {
  const root = path.resolve(__dirname, '../..')
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  const files = [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env']

  for (const file of files) {
    loadEnvFile(path.join(root, file))
  }
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/)
    if (!match) continue

    const key = match[1]
    if (process.env[key] !== undefined) continue

    process.env[key] = normalizeEnvValue(match[2] ?? '')
  }
}

function normalizeEnvValue(value) {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1)
  }
  return trimmed.replace(/\s+#.*$/, '')
}
