type CrickpulseLogoProps = {
  variant?: "horizontal" | "primary";
  className?: string;
};

export const CRICKPULSE_SLOGAN = "LIVE SCORE. PLAYER STATS. EVERY BALL.";

export function CrickpulseLogo({ variant = "horizontal", className = "" }: CrickpulseLogoProps) {
  return <img src="/brand/crickpulse-logo.png" alt="Crickpulse" className={`crickpulse-logo crickpulse-logo-${variant} ${className}`} />;
}
