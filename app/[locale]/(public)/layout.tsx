"use client";

import React from "react";
import { PublicMobileNav } from "@/components/public-mobile-nav";
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-stadium-shell min-h-screen pb-20 md:pb-0">
      <div className="public-stadium-overlay" aria-hidden="true" />
      <div className="public-stadium-content">{children}</div>
      <PublicMobileNav />
    </div>
  );
}
