"use client";

import { useActionState } from "react";
import { setPassword } from "@/app/login/actions";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="label block mb-1.5">New password</span>
        <input className="input" type="password" name="password" required minLength={10} autoComplete="new-password" />
      </label>
      <label className="block">
        <span className="label block mb-1.5">Confirm password</span>
        <input className="input" type="password" name="confirm" required minLength={10} autoComplete="new-password" />
      </label>
      <p className="text-xs text-mute">At least 10 characters.</p>
      {state?.error && <div className="text-xs text-bad">{state.error}</div>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Saving…" : "Save and continue"}</button>
    </form>
  );
}
