"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    if (error) {
      setState("error");
      setMsg("We couldn't send the link. Check the email address and try again.");
    } else setState("sent");
  };
  if (state === "sent") return <div className="rounded-md bg-good-dim text-good text-sm px-3 py-2">Check your inbox for the sign-in link.</div>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <input className="input" type="email" required placeholder="you@yourbrand.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      {msg && <div className="text-xs text-bad">{msg}</div>}
      <button className="btn btn-primary w-full justify-center" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a link"}</button>
    </form>
  );
}
