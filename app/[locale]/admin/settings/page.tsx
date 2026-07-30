"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Eye, EyeOff, Globe2, Loader2, LockKeyhole, Moon, Palette, Save, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("en");
  const [saved, setSaved] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("Not enabled");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      setNotifications(localStorage.getItem("cp-admin-notifications") !== "off");
      setLanguage(localStorage.getItem("cp-admin-language") || "en");
      if ("Notification" in window) setNotificationStatus(Notification.permission === "granted" ? "Enabled on this device" : Notification.permission === "denied" ? "Blocked by browser" : "Permission required");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const enablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return setNotificationStatus("This browser does not support notifications");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setNotificationStatus("Blocked by browser");
    const registration = await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) { new Notification("CrickPulse notifications enabled", { body: "Live alerts are ready on this device." }); setNotificationStatus("Enabled locally · add VAPID key for background push"); return; }
    const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const { data: auth } = await supabase.auth.getUser();
    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert({ user_id: auth.user?.id, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth_key: json.keys?.auth, user_agent: navigator.userAgent }, { onConflict: "endpoint" });
    setNotificationStatus(error ? error.message : "Background push enabled");
  };

  const save = () => {
    localStorage.setItem("cp-admin-notifications", notifications ? "on" : "off");
    localStorage.setItem("cp-admin-language", language);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus(null);
    if (newPassword.length < 8) return setPasswordStatus({ type: "error", message: "New password must contain at least 8 characters." });
    if (newPassword !== confirmPassword) return setPasswordStatus({ type: "error", message: "New passwords do not match." });
    if (currentPassword === newPassword) return setPasswordStatus({ type: "error", message: "Choose a password different from the current password." });
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
    setChangingPassword(false);
    if (error) return setPasswordStatus({ type: "error", message: error.message });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordStatus({ type: "success", message: "Password changed successfully." });
  };

  return <div className="admin-themed-page mx-auto max-w-4xl space-y-6">
    <header><p className="text-sm font-black uppercase tracking-[.18em] text-primary">Workspace preferences</p><h1 className="mt-1 text-3xl font-black">Settings</h1><p className="mt-2 text-muted-foreground">Control the CrickPulse admin appearance and match alerts on this device.</p></header>
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3"><Palette className="h-6 w-6 text-primary" /><div><h2 className="font-black">Appearance</h2><p className="text-sm text-muted-foreground">Choose day, night or system mode.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{([{ id: "light", label: "Day mode", icon: Sun }, { id: "dark", label: "Night mode", icon: Moon }, { id: "system", label: "System", icon: Globe2 }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTheme(id)} className={`flex items-center justify-between rounded-xl border p-4 font-bold transition ${mounted && theme === id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}><span className="flex items-center gap-2"><Icon className="h-5 w-5" />{label}</span>{mounted && theme === id && <Check className="h-4 w-4" />}</button>)}</div></section>
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-3"><Bell className="h-6 w-6 text-primary" /><div><h2 className="font-black">Match notifications</h2><p className="text-sm text-muted-foreground">Enable device and background push alerts for live matches.</p></div></div><label className="mt-5 flex cursor-pointer items-center justify-between rounded-xl border border-border p-4"><span className="font-bold">Live match and result alerts</span><input type="checkbox" checked={notifications} onChange={(event) => setNotifications(event.target.checked)} className="h-5 w-5 accent-primary" /></label><div className="mt-3 flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Browser push status</p><p className="text-xs text-muted-foreground">{notificationStatus}</p></div><button type="button" onClick={() => void enablePush()} className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">Enable notifications</button></div><label className="mt-4 block text-sm font-bold text-muted-foreground">Interface language<select value={language} onChange={(event) => setLanguage(event.target.value)} className="mt-2 block w-full rounded-xl border border-input bg-background px-3 py-2.5 font-semibold text-foreground"><option value="en">English</option><option value="ta">Tamil</option></select></label></section>
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><LockKeyhole className="h-6 w-6 text-primary" /><div><h2 className="font-black">Change password</h2><p className="text-sm text-muted-foreground">Update the password used to sign in to this admin account.</p></div></div>
      <form onSubmit={changePassword} className="mt-5 space-y-4">
        <PasswordInput label="Current password" value={currentPassword} onChange={setCurrentPassword} visible={showPasswords} autoComplete="current-password" />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} visible={showPasswords} autoComplete="new-password" />
          <PasswordInput label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showPasswords} autoComplete="new-password" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => setShowPasswords((value) => !value)} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted">{showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{showPasswords ? "Hide passwords" : "Show passwords"}</button>
          <button type="submit" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}Update password</button>
        </div>
        {passwordStatus && <p role="status" aria-live="polite" className={`rounded-xl px-4 py-3 text-sm font-bold ${passwordStatus.type === "success" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>{passwordStatus.message}</p>}
      </form>
    </section>
    <div className="flex items-center justify-end gap-3">{saved && <span role="status" className="font-bold text-emerald-500">Settings saved</span>}<button type="button" onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-black text-primary-foreground"><Save className="h-4 w-4" />Save settings</button></div>
  </div>;
}

function PasswordInput({ label, value, onChange, visible, autoComplete }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; autoComplete: "current-password" | "new-password" }) {
  return <label className="block text-sm font-bold"><span>{label}</span><input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} minLength={8} required className="mt-2 block min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/30" /></label>;
}
