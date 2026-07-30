import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

import { asLocale, entityMetadata, seoCopy, siteUrl } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const localized = seoCopy(locale);
  return {
    ...entityMetadata({
      locale,
      path: "",
      title: `${localized.site} | Live Cricket Scoring`,
      description: localized.description,
    }),
    metadataBase: siteUrl(),
    title: { default: `${localized.site} | Live Cricket Scoring`, template: `%s | ${localized.site}` },
    manifest: "/manifest.webmanifest",
    applicationName: "CrickPulse",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CrickPulse" },
    icons: {
      icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    formatDetection: { telephone: false },
  };
}

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

const routing = {
  locales: ['en', 'ta', 'si'],
  defaultLocale: 'en'
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  
  if (!routing.locales.includes(locale)) {
    notFound();
  }
 
  const messages = await getMessages();
  const themeScript = `
    (() => {
      try {
        const saved = localStorage.getItem("theme");
        const theme = saved === "light" || saved === "dark"
          ? saved
          : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(theme);
        document.documentElement.style.colorScheme = theme;
      } catch {}
    })();
  `;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body
        className="antialiased bg-background text-foreground"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            {children}
            <PwaInstallBanner />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
