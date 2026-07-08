/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV,
  },
  async rewrites() {
    const isPreviewStub = (process.env.PREVIEW_STUB || '').toString() === '1'
    const rules = [
      { source: '/api/auth/:path*', destination: '/api/auth/:path*' },
      // 保留 BFF 直连路由，不再二次重写
      { source: '/api/go/:path*', destination: '/api/go/:path*' },
    ]
    if (!isPreviewStub) {
      rules.push({ source: '/api/:path*', destination: '/api/go/:path*' })
    }
    return rules
  },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
}

export default nextConfig
