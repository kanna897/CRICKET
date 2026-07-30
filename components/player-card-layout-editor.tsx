"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import {
  normalizePlayerCardLayout,
  PLAYER_CARD_SIZE,
  type PlayerCardLayout,
  type PlayerCardTextLayout,
} from "@/lib/player-card-layout";

type TextKey = "name" | "role" | "batting" | "bowling" | "phone" | "serial";

const labels: Record<TextKey, string> = {
  name: "Player Name",
  role: "Playing Role",
  batting: "Batting Style",
  bowling: "Bowling Style",
  phone: "Phone Number",
  serial: "S.NO",
};

const samples: Record<TextKey, string> = {
  name: "Ks Jathusan",
  role: "All-Rounder",
  batting: "Right Hand",
  bowling: "Right-Arm Fast",
  phone: "0771234567",
  serial: "01",
};

export function PlayerCardLayoutEditor({
  templateName,
  imageUrl,
  initialLayout,
  onClose,
  onSave,
}: {
  templateName: string;
  imageUrl: string;
  initialLayout: unknown;
  onClose: () => void;
  onSave: (layout: PlayerCardLayout) => Promise<void>;
}) {
  const [layout, setLayout] = useState(() => normalizePlayerCardLayout(initialLayout));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const scale = useMemo(() => 100 / PLAYER_CARD_SIZE, []);

  const updatePhoto = (key: keyof PlayerCardLayout["photo"], value: string) => {
    setLayout((current) => ({ ...current, photo: { ...current.photo, [key]: Number(value) || 0 } }));
  };

  const updateText = <K extends keyof PlayerCardTextLayout>(field: TextKey, key: K, value: PlayerCardTextLayout[K]) => {
    setLayout((current) => ({ ...current, [field]: { ...current[field], [key]: value } }));
  };

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const normalized = normalizePlayerCardLayout(layout);
      await onSave(normalized);
      setLayout(normalized);
      setMessage("Layout saved. New registrations will use these coordinates.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Layout could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/75 p-4">
    <section className="mx-auto w-full max-w-7xl rounded-3xl border border-border bg-card p-5 text-foreground shadow-2xl sm:p-7">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-primary">1080 × 1080 · 300 DPI</p><h2 className="mt-1 text-2xl font-black">Configure {templateName}</h2><p className="mt-1 text-sm text-muted-foreground">Coordinates use the final 1080px canvas. The uploaded image remains the untouched background.</p></div>
        <button type="button" onClick={onClose} aria-label="Close layout editor" className="rounded-full bg-muted p-2"><X className="h-5 w-5" /></button>
      </header>
      {message && <p role="status" className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm font-bold">{message}</p>}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(22rem,1fr)_minmax(36rem,1.35fr)]">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-black" style={{ containerType: "inline-size" }}>
            <Image unoptimized width={128} height={128} src={imageUrl} alt={`${templateName} layout preview`} className="absolute inset-0 h-full w-full object-fill" />
            <div className="absolute border-2 border-dashed border-fuchsia-400 bg-fuchsia-400/10" style={{
              left: `${layout.photo.x * scale}%`,
              top: `${layout.photo.y * scale}%`,
              width: `${layout.photo.width * scale}%`,
              height: `${layout.photo.height * scale}%`,
              borderRadius: `${layout.photo.borderRadius * scale}%`,
            }}><span className="rounded-br bg-fuchsia-600 px-1.5 py-1 text-[.55rem] font-black text-white">PHOTO</span></div>
            {(Object.keys(labels) as TextKey[]).map((field) => {
              const item = layout[field];
              const translate = item.textAlignment === "center" ? "-50%" : item.textAlignment === "right" ? "-100%" : "0";
              return <span key={field} className="absolute whitespace-nowrap leading-none" style={{
                left: `${item.x * scale}%`,
                top: `${(item.y - item.fontSize) * scale}%`,
                maxWidth: `${item.maxWidth * scale}%`,
                transform: `translateX(${translate})`,
                color: item.fontColour,
                fontFamily: item.fontFamily,
                fontSize: `${item.fontSize * scale}cqw`,
                fontWeight: item.fontWeight,
                fontStyle: item.italic ? "italic" : "normal",
              }}>{samples[field]}</span>;
            })}
          </div>
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Preview guides are editor-only. The exported JPG contains only the original template, player photo and rendered values.</p>
        </div>
        <div className="space-y-5">
          <fieldset className="rounded-2xl border border-border p-4">
            <legend className="px-2 font-black">Player Photo Frame</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(["x", "y", "width", "height", "borderRadius"] as const).map((key) => <NumberField key={key} label={key === "borderRadius" ? "Radius" : key.toUpperCase()} value={layout.photo[key]} onChange={(value) => updatePhoto(key, value)} />)}
            </div>
          </fieldset>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="min-w-[56rem] w-full text-left text-xs">
              <thead className="bg-muted"><tr><th className="p-3">Field</th><th>X</th><th>Y</th><th>Size</th><th>Max width</th><th>Font family</th><th>Colour</th><th>Align</th></tr></thead>
              <tbody className="divide-y divide-border">
                {(Object.keys(labels) as TextKey[]).map((field) => {
                  const item = layout[field];
                  return <tr key={field}>
                    <th className="p-3">{labels[field]}</th>
                    <td><TableNumber value={item.x} onChange={(value) => updateText(field, "x", value)} /></td>
                    <td><TableNumber value={item.y} onChange={(value) => updateText(field, "y", value)} /></td>
                    <td><TableNumber value={item.fontSize} onChange={(value) => updateText(field, "fontSize", value)} /></td>
                    <td><TableNumber value={item.maxWidth} onChange={(value) => updateText(field, "maxWidth", value)} /></td>
                    <td><input className="input min-w-28" value={item.fontFamily} onChange={(event) => updateText(field, "fontFamily", event.target.value)} /></td>
                    <td><input aria-label={`${labels[field]} font colour`} type="color" className="h-10 w-14 rounded border border-border bg-transparent p-1" value={item.fontColour} onChange={(event) => updateText(field, "fontColour", event.target.value)} /></td>
                    <td><select className="input min-w-24" value={item.textAlignment} onChange={(event) => updateText(field, "textAlignment", event.target.value as PlayerCardTextLayout["textAlignment"])}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}Save Template Layout</button>
        </div>
      </div>
    </section>
  </div>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-xs font-bold"><span>{label}</span><input type="number" min="0" max="1080" className="input" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TableNumber({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input aria-label="Coordinate" type="number" min="0" max="1080" className="input w-20" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />;
}
