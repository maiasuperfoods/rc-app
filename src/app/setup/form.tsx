"use client";

import { useActionState } from "react";
import { bootstrapCoach } from "./actions";

export function SetupForm() {
  const [state, action, pending] = useActionState(bootstrapCoach, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="label block mb-1.5">Setup code</span>
        <input className="input font-mono" name="code" required autoComplete="off" />
      </label>
      <label className="block">
        <span className="label block mb-1.5">Your name</span>
        <input className="input" name="name" required autoComplete="name" />
      </label>
      <label className="block">
        <span className="label block mb-1.5">Email</span>
        <input className="input" type="email" name="email" required autoComplete="email" />
      </label>
      <label className="block">
        <span className="label block mb-1.5">Password</span>
        <input className="input" type="password" name="password" required minLength={10} autoComplete="new-password" />
      </label>
      {state?.error && <div className="text-xs text-bad">{state.error}</div>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Creating…" : "Create coach account"}</button>
    </form>
  );
}
