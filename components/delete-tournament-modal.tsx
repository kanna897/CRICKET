"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type DeletableTournament = {
  id: string;
  name: string;
};

type DeleteTournamentModalProps = {
  tournament: DeletableTournament | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (tournament: DeletableTournament) => void;
};

export function DeleteTournamentModal({
  tournament,
  isOpen,
  onClose,
  onDeleted,
}: DeleteTournamentModalProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmationInput("");
      setErrorMessage(null);
      setIsDeleting(false);
    }
  }, [isOpen, tournament]);

  if (!isOpen || !tournament) return null;

  const isConfirmed = confirmationInput.trim() === tournament.name.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!tournament || !isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("delete_tournament_permanent", {
        p_tournament_id: tournament.id,
      });

      if (error) {
        throw new Error(error.message || "Failed to delete tournament.");
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || (data as { ok?: boolean }).ok !== true) {
        throw new Error("Tournament was not found or could not be permanently deleted.");
      }

      onDeleted(tournament);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred during deletion.");
      setIsDeleting(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-tournament-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-red-500/30 bg-card p-6 text-card-foreground shadow-2xl animate-in zoom-in-95 duration-150 sm:p-7">
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-tournament-title" className="text-xl font-black text-foreground">
              Delete Tournament
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This action is permanent and cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-950 dark:text-red-200">
            <p className="font-semibold">
              Tournament: <span className="font-black underline">{tournament.name}</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-red-900/90 dark:text-red-300">
              This will permanently delete this tournament and its tournament-owned data (fixtures, matches, innings, deliveries, player registrations, auction sessions, and awards). Reusable team and player profiles will remain preserved.
            </p>
          </div>

          {errorMessage && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="confirm-tournament-name" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Type <span className="font-black text-foreground select-all">{tournament.name}</span> to confirm:
              </label>
              <input
                id="confirm-tournament-name"
                type="text"
                autoComplete="off"
                disabled={isDeleting}
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={tournament.name}
                className="mt-2 block w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isConfirmed || isDeleting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Permanently Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
