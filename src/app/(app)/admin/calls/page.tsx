import Link from "next/link";
import { requireCoach } from "@/lib/data";
import { pcConfigured } from "@/lib/pc/client";
import { allCalls } from "@/lib/pc/queries";
import { Card, PageHeader, Pill } from "@/components/ui";
import { fmtDT } from "@/components/coaching/format";
import { AddCallForm, AssignCall, FirefliesImport } from "@/components/coaching/desk-client";

export default async function CallsPage() {
  await requireCoach();
  if (!pcConfigured()) {
    return <><PageHeader title="Calls" /><Card><p className="text-sm text-dim p-4">Coaching data is not connected yet.</p></Card></>;
  }
  const { calls, students, events, unassigned } = await allCalls();
  return (
    <>
      <PageHeader title="Calls" subtitle={`Everything received from Cal.com and the call recorder. ${unassigned ? `${unassigned} unassigned call${unassigned > 1 ? "s" : ""} need a student picked once; that email is remembered.` : "Unassigned calls need a student picked once; that email is remembered."}`} />
      <Card title="Integration log" hint="Last 25 events from Stripe, Cal.com and the recorder" className="mb-4">
        {events.length ? (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>When</th><th>Event</th><th>Details</th></tr></thead><tbody>
            {events.map((e) => <tr key={e.id}><td className="text-dim whitespace-nowrap">{fmtDT(e.created_at)}</td><td><Pill tone={/fail|unmatched|rejected/.test(e.type) ? "bad" : "good"}>{e.type}</Pill></td><td className="text-xs text-mute">{JSON.stringify(e.payload ?? {}).slice(0, 160)}</td></tr>)}
          </tbody></table></div>
        ) : <p className="text-sm text-mute">Nothing received yet. When Cal.com and Fireflies are connected, every booking and transcript shows up here within seconds.</p>}
      </Card>
      <Card className="mb-4">
        <div className="overflow-x-auto"><table className="table"><thead><tr><th>When</th><th>Student</th><th>Title</th><th>Attendees</th><th>Status</th><th>Transcript</th><th /></tr></thead><tbody>
          {calls.map((c) => (
            <tr key={c.id}>
              <td className="text-dim whitespace-nowrap">{fmtDT(c.scheduled_at || c.ended_at || c.created_at)}</td>
              <td>{c.pc_students ? <><Link href={`/admin/pc/${c.student_id}`} className="text-ink hover:text-gold-soft">{c.pc_students.first_name} {c.pc_students.last_name}</Link><div className="mt-1"><AssignCall callId={c.id} students={students} current={c.student_id} /></div></> : <AssignCall callId={c.id} students={students} current={null} />}</td>
              <td>{c.title || c.kind}</td>
              <td className="text-xs text-mute">{(c.attendee_emails ?? []).join(", ")}</td>
              <td><Pill tone="mute">{c.status}</Pill></td>
              <td className="text-dim">{c.transcript ? (c.transcript.length >= 1000 ? `${Math.round(c.transcript.length / 1000)}k chars` : `${c.transcript.length} chars`) : "—"}</td>
              <td className="text-right">{c.recording_url && <a className="text-gold-soft text-xs" href={c.recording_url} target="_blank" rel="noreferrer">recording</a>}</td>
            </tr>
          ))}
          {!calls.length && <tr><td colSpan={7} className="text-mute">No calls yet.</td></tr>}
        </tbody></table></div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Import from Fireflies" hint="Paste a Fireflies meeting ID (from the meeting's URL on app.fireflies.ai) to pull its transcript in now."><FirefliesImport /></Card>
        <Card title="Add a call manually" hint="Paste a transcript. A summary and action items are extracted automatically."><AddCallForm students={students} /></Card>
      </div>
    </>
  );
}
