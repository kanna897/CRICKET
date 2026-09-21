"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type DeletableMatch = {
  id: string;
  match_number?: number | null;
  title?: string | null;
  team_a_name?: string;
  team_b_name?: string;
  match_date?: string | null;
  match_time?: string | null;
  status?: string;
};

type DeleteMatchModalProps = {
  match: DeletableMatch | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (match: DeletableMatch) => void;
};

export function DeleteMatchModal({
  match,
  isOpen,
  onClose,
  onDeleted,
}: DeleteMatchModalProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmationInput("");
      setErrorMessage(null);
      setIsDeleting(false);
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const confirmTarget = "DELETE";
  const isConfirmed = confirmationInput.trim().toUpperCase() === confirmTarget;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!match || !isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.rpc("delete_match_permanent", {
        p_match_id: match.id,
      });

      if (error) {
        throw new Error(error.message || "Failed to delete match.");
      }

      if (!data || typeof data !== "object" || Array.isArray(data) || (data as { ok?: boolean }).ok !== true) {
        throw new Error("Match was not found or could not be permanently deleted.");
      }

      onDeleted(match);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred during match deletion.");
      setIsDeleting(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  }

  const matchLabel = match.match_number ? `Match #${match.match_number}` : match.title || "Match";
  const matchHeading = match.team_a_name && match.team_b_name
    ? `${match.team_a_name} vs ${match.team_b_name}`
    : matchLabel;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-match-title"
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
            <h2 id="delete-match-title" className="text-xl font-black text-foreground">
              Delete Match
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This action is permanent and cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-950 dark:text-red-200">
            <p className="font-semibold">
              {matchLabel}: <span className="font-black underline">{matchHeading}</span>
            </p>
            {(match.match_date || match.status) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {match.match_date && <span>Date: {match.match_date} · </span>}
                {match.status && <span className="capitalize">Status: {match.status}</span>}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-red-900/90 dark:text-red-300">
              This will permanently delete this match along with all associated scoring events, innings, ball-by-ball deliveries, and scorecards. Teams and player master profiles will remain preserved.
            </p>
          </div>

          {errorMessage && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="confirm-match-delete" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Type <span className="font-black text-foreground select-all">{confirmTarget}</span> to confirm:
              </label>
              <input
                id="confirm-match-delete"
                type="text"
                autoComplete="off"
                disabled={isDeleting}
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={confirmTarget}
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
