"use client";
import { useState, useTransition } from "react";
import { addCoachNote, annotateWbr, coachViewTenant } from "@/app/actions";

export function CoachTools({ tenantId, reportId, existingAnnotation }: { tenantId: string; reportId: string | null; existingAnnotation: string | null }) {
  const [mode, setMode] = useState<"none" | "note" | "annotate">("none");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (mode === "note") await addCoachNote(tenantId, text);
      if (mode === "annotate" && reportId) await annotateWbr(tenantId, reportId, text);
      setText("");
      setMode("none");
    });
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button className="btn btn-ghost" onClick={() => start(() => coachViewTenant(tenantId))}>View as student</button>
        <button className="btn btn-ghost" onClick={() => { setMode("note"); setText(""); }}>Add note</button>
        <button className="btn btn-secondary" onClick={() => { setMode("annotate"); setText(existingAnnotation ?? ""); }} disabled={!reportId} title={reportId ? "" : "A saved weekly report is needed to annotate (the Monday job creates it)"}>Annotate review</button>
      </div>
      {mode !== "none" && (
        <div className="card-elev p-3 w-96 flex flex-col gap-2">
          <textarea className="input min-h-24" value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "note" ? "Private coach note…" : "Shown to the student under this week's commentary…"} />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setMode("none")}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={pending || !text.trim()}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
