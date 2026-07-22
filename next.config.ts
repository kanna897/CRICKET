import type { NextConfig } from "next";
import path from "path";
import withPWA from "next-pwa";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const config: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  importScripts: ["/push-handler.js"],
})(withNextIntl(config));
