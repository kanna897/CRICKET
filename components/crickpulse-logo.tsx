import Image from "next/image";
type CrickpulseLogoProps = {
  variant?: "horizontal" | "primary";
  className?: string;
};

export const CRICKPULSE_SLOGAN = "LIVE SCORE. PLAYER STATS. EVERY BALL.";

export function CrickpulseLogo({ variant = "horizontal", className = "" }: CrickpulseLogoProps) {
  return <Image width={176} height={44} sizes="176px" src="/brand/crickpulse-logo.webp" alt="Crickpulse" className={`crickpulse-logo crickpulse-logo-${variant} ${className}`} />;
}
