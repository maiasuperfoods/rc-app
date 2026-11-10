import Link from "next/link";
import { after } from "next/server";
import { requireCoach } from "@/lib/data";
import { pcConfigured } from "@/lib/pc/client";
import { allCalls } from "@/lib/pc/queries";
import { firefliesAccounts, syncFireflies } from "@/lib/pc/mutations";
import { Card, PageHeader, Pill } from "@/components/ui";
import { fmtDT } from "@/components/coaching/format";
import { AddCallForm, AssignCall, FirefliesImport, SyncCalls } from "@/components/coaching/desk-client";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  await requireCoach();
  if (!pcConfigured()) {
    return <><PageHeader title="Calls" /><Card><p className="text-sm text-dim p-4">Coaching data is not connected yet.</p></Card></>;
  }
  const [{ calls, students, events, unassigned }, accounts] = await Promise.all([allCalls(), firefliesAccounts()]);
  // Opening this page is the moment a coach cares about new transcripts, so pull them after the
  // response goes out. The nightly job catches anything nobody looks at.
  after(() => syncFireflies().catch(() => {}));
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
        <Card title="Fireflies" hint="New coaching calls are pulled in automatically — only meetings a student attended, matched on their email. No other meeting in these workspaces is ever fetched.">
          <div className="mb-4">
            <div className="label mb-2">Connected accounts</div>
            {accounts.length ? (
              <ul className="space-y-1.5 text-xs">
                {accounts.map((a) => (
                  <li key={a.label} className="flex items-start gap-2">
                    <Pill tone={a.ok ? "good" : "bad"}>{a.ok ? "connected" : "failing"}</Pill>
                    <span className="text-dim min-w-0">{a.ok ? (a.emails.length ? a.emails.join(", ") : "workspace reachable, no members listed") : a.error}<span className="text-mute"> · {a.label}</span></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-mute">No Fireflies account connected. Set FIREFLIES_API_KEY to the coaching accounts&apos; API keys, comma-separated.</p>}
          </div>
          <SyncCalls />
          <div className="border-t border-line mt-4 pt-4">
            <div className="label mb-2">Import one by ID</div>
            <p className="text-xs text-mute mb-2">For a call the automatic sync missed — e.g. the student joined from an address we don&apos;t have on file. Paste the meeting ID from its app.fireflies.ai URL.</p>
            <FirefliesImport />
          </div>
        </Card>
        <Card title="Add a call manually" hint="Paste a transcript. A summary and action items are extracted automatically."><AddCallForm students={students} /></Card>
      </div>
    </>
  );
}
