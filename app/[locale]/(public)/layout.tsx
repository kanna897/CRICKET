"use client";

import React from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
