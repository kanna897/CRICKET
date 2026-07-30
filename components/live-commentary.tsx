"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CommentaryBall = { id: string; commentary: string | null; created_at: string };
const visibleCommentary = (commentary: string | null) => commentary?.replace(/\s*\[zone:[^\]]+\]\s*$/, "") || "";

export function LiveCommentary({ inningsId }: { inningsId: string | null }) {
  const [items, setItems] = useState<CommentaryBall[]>([]);
  useEffect(() => {
    if (!inningsId) return;
    async function load() {
      const { data } = await supabase.from("ball_by_ball").select("id,commentary,created_at").eq("innings_id", inningsId).not("commentary", "is", null).order("created_at", { ascending: false }).limit(1);
      if (data) setItems(data);
    }
    load();
    const channel = supabase.channel(`commentary:${inningsId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "ball_by_ball", filter: `innings_id=eq.${inningsId}` }, (payload) => {
      const ball = payload.new as CommentaryBall;
      if (ball.commentary) setItems([ball]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [inningsId]);
  return <section className="bg-card border border-border rounded-xl p-4"><h2 className="font-semibold text-lg mb-3">Live Commentary</h2>{items.length ? <p className="text-base leading-relaxed">{visibleCommentary(items[0].commentary)}</p> : <p className="text-sm text-muted-foreground">Commentary will appear after the first ball.</p>}</section>;
}
