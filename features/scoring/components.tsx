import type { CSSProperties, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function ScoringModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"><div className="bg-card rounded-xl p-6 w-full max-w-md space-y-4"><h2 className="text-xl font-bold">{title}</h2>{children}<button onClick={onClose} className="text-sm text-muted-foreground">Close</button></div></div>;
}

export function ScoringSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="block text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-input bg-background p-2"><option value="">Select…</option>{options.filter(([optionValue]) => optionValue).map(([optionValue, name]) => <option key={optionValue} value={optionValue}>{name}</option>)}</select></label>;
}

export function NumberChoice({ label, value, values, onChange, disabled = false }: { label: string; value: number; values: number[]; onChange: (value: number) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="space-y-2 disabled:opacity-45"><legend className="text-sm font-medium">{label}</legend><div className="grid grid-cols-7 gap-1.5">{values.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`min-h-10 rounded-lg border text-sm font-black ${value === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}>{item}</button>)}</div></fieldset>;
}

export function ModalActions({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) {
  return <div className="flex justify-end gap-2 pt-2"><button onClick={onCancel} className="control">Cancel</button><button onClick={onSave} disabled={saving} className="control bg-primary text-primary-foreground">{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin"/>}{label}</button></div>;
}

export function ScoreCelebration({ color, teamName }: { color: string; teamName: string }) {
  return <div aria-hidden="true" className="score-celebration" style={{ "--celebration-color": color } as CSSProperties}><span className="score-ribbon score-ribbon-one"/><span className="score-ribbon score-ribbon-two"/><span className="score-ribbon score-ribbon-three"/><span className="score-ribbon score-ribbon-four"/><span className="score-ribbon score-ribbon-five"/><span className="score-win-message">{teamName} WIN!</span></div>;
}

export function BoundaryPop({ runs }: { runs: 4 | 6 }) {
  return <span aria-hidden="true" className={`boundary-pop boundary-pop-${runs}`}>{runs === 4 ? "FOUR!" : "SIX!"}</span>;
}

export function WicketPop({ type }: { type: string }) {
  const label = type.replace("_", " ").toUpperCase();
  return <div aria-hidden="true" className={`wicket-pop wicket-pop-${type}`}><span>WICKET!</span><strong>{label}</strong></div>;
}

export function HatTrickPop({ bowlerName }: { bowlerName: string }) {
  return <div role="status" aria-live="assertive" className="hat-trick-pop"><span className="hat-trick-burst"/><p>🎩 THREE IN THREE</p><strong>HAT-TRICK!</strong><small>{bowlerName}</small></div>;
}
