import { RegistrationStatusChecker } from "@/components/registration-status-checker";

export default function RegistrationStatusPage() {
  return (
    <main className="player-registration-page mx-auto min-h-[70vh] max-w-3xl p-4 py-10 sm:p-7">
      <header className="mb-6 text-foreground">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          Player registration
        </p>
        <h1 className="mt-2 text-3xl font-black">Track your application</h1>
        <p className="mt-2 text-muted-foreground">
          Organizer review status-ஐ secure tracking details use பண்ணி பார்க்கலாம்.
        </p>
      </header>
      <RegistrationStatusChecker />
    </main>
  );
}
