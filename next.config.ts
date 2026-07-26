import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const config: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default withNextIntl(config);
