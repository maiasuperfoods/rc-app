"use client";
import { useState } from "react";
import type { IntegrationStatus } from "@/lib/types";

/**
 * OAuth providers go through /api/integrations/{provider}/start which redirects
 * to the provider. Key-based providers post the key to /api/integrations/{provider}/key;
 * the key is encrypted server-side and never returned.
 */
export function ConnectButton({ provider, auth, connected, needsReconnect, demo }: { provider: IntegrationStatus["provider"]; auth: "oauth" | "key"; connected: boolean; needsReconnect: boolean; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [extra, setExtra] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const label = needsReconnect ? "Reconnect" : connected ? "Reconnect" : "Connect";

  if (demo) return <button className="btn btn-ghost" title="Connections are disabled on demo data">{label}</button>;

  if (auth === "oauth") {
    return (
      <a className={`btn ${connected && !needsReconnect ? "btn-ghost" : "btn-primary"}`} href={`/api/integrations/${provider}/start`}>
        {label}
      </a>
    );
  }
  const submit = async () => {
    setState("saving");
    const res = await fetch(`/api/integrations/${provider}/key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, extra }) });
    if (res.ok) {
      setState("done");
      setKey("");
      setMsg("Connected. The first sync starts within the hour.");
      setTimeout(() => location.reload(), 1200);
    } else {
      setState("error");
      setMsg((await res.json().catch(() => ({})))?.message ?? "That key didn't work. Check it and try again.");
    }
  };
  return (
    <div>
      {!open ? (
        <button className={`btn ${connected && !needsReconnect ? "btn-ghost" : "btn-primary"}`} onClick={() => setOpen(true)}>{label}</button>
      ) : (
        <div className="flex flex-col gap-2 items-end">
          <input className="input w-64" type="password" placeholder="Paste API key" value={key} onChange={(e) => setKey(e.target.value)} />
          {provider === "triple_whale" && <input className="input w-64" placeholder="Shop domain (yourstore.myshopify.com)" value={extra} onChange={(e) => setExtra(e.target.value)} />}
          {provider === "commslayer" && <input className="input w-64" placeholder="Account ID" value={extra} onChange={(e) => setExtra(e.target.value)} />}
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!key || state === "saving"}>{state === "saving" ? "Checking…" : "Save"}</button>
          </div>
          {msg && <div className={`text-xs ${state === "error" ? "text-bad" : "text-good"}`}>{msg}</div>}
        </div>
      )}
    </div>
  );
}
