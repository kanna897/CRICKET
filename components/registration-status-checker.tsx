"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type StatusResult = { playerName: string; tournamentName: string; status: "pending"|"approved"|"rejected"; submittedAt: string; reviewedAt: string|null };
type LookupResponse = { found?: boolean; registration?: StatusResult; error?: string };

export function RegistrationStatusChecker() {
  const [code,setCode]=useState(""); const [contact,setContact]=useState("");
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState(""); const [result,setResult]=useState<StatusResult|null>(null);
  useEffect(()=>{const timer=window.setTimeout(()=>{try{const saved=JSON.parse(localStorage.getItem("crickpulse-player-registration")||"{}") as {code?:string;contact?:string};setCode(saved.code||"");setContact(saved.contact||"");}catch{}},0);return()=>window.clearTimeout(timer);},[]);
  async function check(event:FormEvent){event.preventDefault();setLoading(true);setMessage("");setResult(null);
    const {data,error}=await supabase.functions.invoke<LookupResponse>("player-registration-status",{body:{trackingCode:code,contactNumber:contact}});
    if(error){let detail=error.message;try{const response=(error as {context?:Response}).context;const payload=response?await response.clone().json() as LookupResponse:null;detail=payload?.error||detail;}catch{}setMessage(detail||"Status could not be checked.");}
    else if(!data?.found||!data.registration)setMessage("No matching registration found. Check both details and try again."); else setResult(data.registration);setLoading(false);
  }
  return <section className="rounded-3xl border border-border bg-card p-5 text-foreground shadow-xl sm:p-6">
    <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-6 w-6"/></span><div><h2 className="text-xl font-black">Check registration status</h2><p className="mt-1 text-sm text-muted-foreground">Tracking code + contact number use பண்ணி secure-ஆ status பார்க்கலாம்.</p></div></div>
    <form onSubmit={check} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-sm font-bold"><span className="mb-2 block">Tracking code</span><input required minLength={12} maxLength={12} pattern="[A-Fa-f0-9]{12}" autoCapitalize="characters" autoComplete="off" className="input font-mono uppercase" placeholder="A1B2C3D4E5F6" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label>
      <label className="text-sm font-bold"><span className="mb-2 block">Contact number</span><input required minLength={7} maxLength={30} inputMode="tel" autoComplete="tel" className="input" placeholder="+94 7X XXX XXXX" value={contact} onChange={e=>setContact(e.target.value)}/></label>
      <button disabled={loading} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-50">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>}Check</button>
    </form>
    {message&&<p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">{message}</p>}
    {result&&<div role="status" className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-50"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black">{result.playerName}</p><p className="text-sm opacity-80">{result.tournamentName}</p></div><span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-black uppercase text-white">{result.status}</span></div><p className="mt-3 text-xs opacity-75">Submitted {new Date(result.submittedAt).toLocaleString()}{result.reviewedAt?` · Reviewed ${new Date(result.reviewedAt).toLocaleString()}`:""}</p></div>}
  </section>;
}
