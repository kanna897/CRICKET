"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, ImagePlus, Loader2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/media";
import { useAdminAccess } from "@/components/admin-shell";

type Template = {
  id: string;
  name: string;
  template_type: "player" | "team_player";
  image_url: string;
  public_id: string | null;
  is_visible: boolean;
};

type Choice = {
  player_template_id: string | null;
  team_player_template_id: string | null;
};

export function AuctionTemplateManager({ tournamentId }: { tournamentId: string }) {
  const { userId } = useAdminAccess();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [choice, setChoice] = useState<Choice>({ player_template_id: null, team_player_template_id: null });
  const [uploadType, setUploadType] = useState<Template["template_type"]>("player");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [{ data: templateRows }, { data: selected }] = await Promise.all([
      (supabase.from("card_templates") as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("tournament_card_templates") as any)
        .select("player_template_id,team_player_template_id")
        .eq("tournament_id", tournamentId)
        .maybeSingle(),
    ]);
    setTemplates((templateRows || []) as Template[]);
    if (selected) setChoice(selected as Choice);
  }, [tournamentId]);

  useEffect(() => { void load(); }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy("upload");
    setMessage("");
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadImage(file, "auction-templates");
        const name = file.name.replace(/\.[^.]+$/, "").trim() || "Auction template";
        const { error } = await (supabase.from("card_templates") as any).insert({
          organizer_id: userId,
          name,
          template_type: uploadType,
          image_url: uploaded.url,
          public_id: uploaded.publicId,
          is_visible: true,
        });
        if (error) throw error;
      }
      setMessage(`${files.length} template${files.length === 1 ? "" : "s"} uploaded.`);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Template upload failed.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(template: Template) {
    setBusy(template.id);
    setMessage("");
    try {
      const nextVisible = !template.is_visible;
      const { error } = await (supabase.from("card_templates") as any)
        .update({ is_visible: nextVisible, updated_at: new Date().toISOString() })
        .eq("id", template.id);
      if (error) throw error;
      if (!nextVisible && (choice.player_template_id === template.id || choice.team_player_template_id === template.id)) {
        const nextChoice = {
          ...choice,
          player_template_id: choice.player_template_id === template.id ? null : choice.player_template_id,
          team_player_template_id: choice.team_player_template_id === template.id ? null : choice.team_player_template_id,
        };
        await saveChoice(nextChoice);
      }
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Template visibility could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function saveChoice(next: Choice) {
    if (!next.player_template_id && !next.team_player_template_id) {
      await (supabase.from("tournament_card_templates") as any).delete().eq("tournament_id", tournamentId);
      setChoice(next);
      return;
    }
    const { error } = await (supabase.from("tournament_card_templates") as any).upsert({
      tournament_id: tournamentId,
      ...next,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tournament_id" });
    if (error) throw error;
    setChoice(next);
  }

  async function select(type: Template["template_type"], templateId: string) {
    setBusy(`select-${type}`);
    setMessage("");
    try {
      const next = type === "player"
        ? { ...choice, player_template_id: templateId || null }
        : { ...choice, team_player_template_id: templateId || null };
      await saveChoice(next);
      setMessage("Active tournament template updated.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Template selection failed.");
    } finally {
      setBusy("");
    }
  }

  const visible = (type: Template["template_type"]) => templates.filter((row) => row.template_type === type && row.is_visible);

  return <section className="space-y-5 rounded-xl border border-border bg-card p-6 text-foreground shadow-sm">
    <div><p className="text-xs font-black uppercase tracking-[.18em] text-primary">Auction media</p><h2 className="mt-1 text-xl font-black">Player Card Templates</h2><p className="mt-1 text-sm text-muted-foreground">Upload multiple JPG/PNG backgrounds. Hidden templates cannot be selected; one active template is allowed for each card type.</p></div>
    {message && <p role="status" className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm font-bold">{message}</p>}
    <div className="grid gap-4 lg:grid-cols-[14rem_1fr_auto]">
      <label className="space-y-2 text-sm font-bold">Upload as<select className="input" value={uploadType} onChange={(event) => setUploadType(event.target.value as Template["template_type"])}><option value="player">Player profile card</option><option value="team_player">Team player card</option></select></label>
      <label className="group grid min-h-24 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center hover:bg-primary/10"><input type="file" multiple accept="image/jpeg,image/png" className="sr-only" onChange={(event) => void upload(event.target.files)} /><span><Upload className="mx-auto h-6 w-6 text-primary"/><strong className="mt-2 block text-sm">Upload multiple templates</strong><small className="text-muted-foreground">JPG or PNG · max 5MB each</small></span></label>
      <div className="grid min-w-44 place-items-center rounded-2xl border border-border bg-muted/30 p-4 text-center">{busy === "upload" ? <Loader2 className="h-7 w-7 animate-spin text-primary"/> : <><ImagePlus className="h-7 w-7 text-primary"/><span className="text-xs font-bold">{templates.length} uploaded</span></>}</div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <TemplateSelect label="Active player profile card" value={choice.player_template_id || ""} templates={visible("player")} busy={busy === "select-player"} onChange={(id) => void select("player", id)} />
      <TemplateSelect label="Active team player card" value={choice.team_player_template_id || ""} templates={visible("team_player")} busy={busy === "select-team_player"} onChange={(id) => void select("team_player", id)} />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{templates.map((template) => {
      const active = choice.player_template_id === template.id || choice.team_player_template_id === template.id;
      return <article key={template.id} className={`overflow-hidden rounded-2xl border ${active ? "border-emerald-400 ring-2 ring-emerald-200" : "border-border"} ${template.is_visible ? "bg-background" : "bg-muted opacity-70"}`}><div className="aspect-square overflow-hidden bg-black/5"><img src={template.image_url} alt={template.name} className="h-full w-full object-cover"/></div><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-black">{template.name}</h3><p className="text-xs capitalize text-muted-foreground">{template.template_type.replace("_", " ")}</p></div>{active && <CheckCircle2 className="h-5 w-5 text-emerald-600"/>}</div><button type="button" disabled={busy === template.id} onClick={() => void toggle(template)} className="control w-full justify-center">{template.is_visible ? <Eye className="mr-2 h-4 w-4"/> : <EyeOff className="mr-2 h-4 w-4"/>}{template.is_visible ? "Visible · Hide" : "Hidden · Show"}</button></div></article>;
    })}</div>
  </section>;
}

function TemplateSelect({ label, value, templates, busy, onChange }: { label: string; value: string; templates: Template[]; busy: boolean; onChange: (id: string) => void }) {
  return <label className="space-y-2 text-sm font-bold">{label}<div className="relative"><select className="input" value={value} disabled={busy} onChange={(event) => onChange(event.target.value)}><option value="">No template selected</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>{busy && <Loader2 className="absolute right-9 top-3 h-4 w-4 animate-spin"/>}</div></label>;
}
