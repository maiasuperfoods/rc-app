"use client";

import { useActionState } from "react";
import { signInWithPassword } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signInWithPassword, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="label block mb-1.5">Email</span>
        <input className="input" type="email" name="email" required autoComplete="email" placeholder="you@yourbrand.com" />
      </label>
      <label className="block">
        <span className="label block mb-1.5">Password</span>
        <input className="input" type="password" name="password" required autoComplete="current-password" />
      </label>
      {state?.error && <div className="text-xs text-bad">{state.error}</div>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-xs text-mute text-center pt-1">Forgot your password? Ask your coach for a reset link.</p>
    </form>
  );
}
