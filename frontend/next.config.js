
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['cdn.cloudflare.steamstatic.com', 'shared.akamai.steamstatic.com'],
  },
}

module.exports = nextConfig