import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy policy · Renaissance Commerce",
  description: "What the Renaissance Commerce platform reads from a connected store, what it stores, who can see it, and how to have it erased.",
};

const UPDATED = "9 November 2026";
const CONTACT = process.env.SUPPORT_EMAIL ?? "admin@renaissancecommerce.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="display text-xl mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-dim leading-relaxed [&_strong]:text-ink [&_strong]:font-medium">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-5 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-10">
          <Logo className="h-8 w-8" />
          <div className="wordmark text-cream">Ren<span className="text-gold italic">ai</span>ssance <span className="text-dim text-xs tracking-[0.2em] uppercase">Commerce</span></div>
        </div>

        <h1 className="display text-3xl mb-2">Privacy policy</h1>
        <p className="text-sm text-mute mb-10">Last updated {UPDATED}</p>

        <Section title="Who this covers">
          <p>
            Renaissance Commerce operates a private analytics and coaching platform at <strong>app.renaissancecommerce.com</strong>, used by merchants enrolled in our coaching program. This policy explains what the platform reads from a connected store, what we keep, who can see it, and how to have it deleted. It applies to the merchant using the platform and to the shoppers whose orders are counted in their reports.
          </p>
        </Section>

        <Section title="What we read from a connected Shopify store">
          <p>When a merchant connects their store, the platform is granted read-only access to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Orders</strong>, including historical orders — order value, refunds, dates, and line items. These produce revenue, average order value, refund rate and cost of goods.</li>
            <li><strong>Products and variants</strong> — titles, SKUs and unit cost, used for unit economics.</li>
            <li><strong>Inventory quantities</strong> — on-hand stock, used for the inventory planner and reorder forecast.</li>
            <li><strong>A customer identifier and order count on each order</strong> — used only to group orders into monthly cohorts and to tell a first-time buyer from a repeat buyer.</li>
          </ul>
          <p>
            We never request, receive or store customer <strong>names, email addresses, phone numbers, shipping or billing addresses, or payment details</strong>. The Shopify permission we hold is limited to the fields listed above. We hold no write access: the platform cannot change anything in a connected store.
          </p>
        </Section>

        <Section title="What we store">
          <p>
            We store <strong>aggregated figures</strong>, not records about individual shoppers: daily totals (revenue, orders, refunds, new and returning counts), product and variant records with costs and stock levels, and monthly cohort averages (how many customers in a month, and their average spend over time). The customer identifier used to build a cohort exists only in memory while a report is calculated; it is never written to our database.
          </p>
          <p>
            We also store what a merchant enters themselves — costs, suppliers, offers, forecast assumptions, brand notes — and, for coaching members, their call notes, action items and progress.
          </p>
          <p>
            Access credentials for connected services are <strong>encrypted at rest</strong> (AES-256-GCM) and are never displayed again after they are saved.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            A merchant&apos;s data is visible to <strong>that merchant</strong> and to the <strong>Renaissance Commerce coaches</strong> assigned to their program, who use it to prepare and run coaching sessions. Coaches have read-only access. No merchant can see another merchant&apos;s data; this is enforced at the database level, not only in the interface.
          </p>
          <p>We do not sell data, share it with advertisers, or use it to train models.</p>
        </Section>

        <Section title="Services we rely on">
          <p>We use a small number of processors, each handling data only to run the platform:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Supabase</strong> — database and authentication (data stored in the EU).</li>
            <li><strong>Vercel</strong> — application hosting.</li>
            <li><strong>Anthropic</strong> — writes the narrative in the weekly business review and summarises coaching calls. It receives <strong>aggregated figures and coaching notes only</strong>, never customer-level data, and the content is not used to train models.</li>
            <li><strong>Resend</strong> — transactional email (sign-in links, weekly reviews).</li>
            <li><strong>Triple Whale, Lifetimely, Meta and Commslayer</strong> — only where a merchant chooses to connect them, and only to read their own account.</li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <p>
            Data is kept while a merchant&apos;s store is connected and their account is active. <strong>Uninstalling the app from Shopify immediately deletes the stored access token</strong> and stops all syncing. Forty-eight hours after an uninstall, Shopify sends an erasure request and we delete everything derived from that store: products, variants, inventory, daily figures and cohorts.
          </p>
          <p>A merchant can ask us to delete their account and all associated data at any time by writing to the address below; we act within 30 days.</p>
        </Section>

        <Section title="Shopper rights and requests">
          <p>
            If a shopper asks a merchant for a copy of their data or for it to be erased, Shopify forwards that request to us automatically. Because we hold no information that identifies a shopper, there is nothing to return and nothing to erase; we record every request and confirm it. Merchants can contact us at the address below for written confirmation.
          </p>
          <p>
            Under the GDPR, the UK GDPR and the CCPA, individuals have rights of access, correction, erasure, restriction and portability. Requests reach us through the merchant whose store the order was placed on, or directly at the address below.
          </p>
        </Section>

        <Section title="Security">
          <p>
            All traffic is encrypted in transit (TLS). Credentials are encrypted at rest with a key held separately from the database. Every request from Shopify is verified cryptographically before it is acted on. Access to production data is limited to the Renaissance Commerce staff who operate the platform.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            If this policy changes materially we notify account holders by email before the change takes effect. Questions, requests and complaints: <a className="text-gold-soft hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </Section>

        <p className="text-xs text-mute border-t border-line pt-6">Renaissance Commerce · app.renaissancecommerce.com</p>
      </div>
    </main>
  );
}
