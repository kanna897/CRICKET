declare module 'next-pwa' {
  import { NextConfig } from 'next';

  export default function withPWA(config: unknown): (nextConfig: NextConfig) => NextConfig;
}
