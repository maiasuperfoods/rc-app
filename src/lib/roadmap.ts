/**
 * The student roadmap: the course and the tools, put in the order a brand actually needs them.
 *
 * The Knowledge Base is organised by subject, not by sequence, and the tools each stand alone.
 * This file is the one place that says "do this, then this": a phase per outcome, each step
 * pointing at the lessons that teach it and the tool where the work is done.
 *
 * To reorder, add or drop a step, edit ROADMAP below. Lessons are referenced by id, so renaming a
 * lesson in the Knowledge Base needs no change here, and a lesson that is deleted simply drops
 * off its step. Steps with an `auto` check tick themselves from the brand's own data; the rest
 * are ticked by hand. Nothing here does I/O.
 */
import type { RoadmapStart, RoadmapState } from "@/lib/types";

/** What the roadmap can see about a brand without asking. */
export interface RoadmapSignals {
  lessonsDone: Set<string>;
  mechanism: boolean;
  avatars: number;
  angles: number;
  offers: number;
  upsells: number;
  products: number;
  suppliers: number;
  connected: { shopify: boolean; tripleWhale: boolean; lifetimely: boolean; meta: boolean; commslayer: boolean };
  hasOrders: boolean;
  hasAdSpend: boolean;
  adsLaunched: boolean;
  forecastSaved: boolean;
  wbrTargets: number;
  wbrItems: number;
}

export interface RoadmapStep {
  id: string;
  title: string;
  /** One line: what this gets you. */
  why: string;
  /** Knowledge Base lesson ids, in reading order. */
  lessons?: string[];
  /** Where the work is done in the app. */
  tool?: { href: string; label: string };
  /** A vault or reference to work from. */
  resource?: { href: string; label: string };
  /** In plain words, what "done" means. Shown under the step. */
  doneWhen: string;
  /** Ticks the step from the brand's data. Without it the step is ticked by hand (or by finishing its lessons). */
  auto?: (s: RoadmapSignals) => boolean;
  /** Worth doing, but the roadmap moves on without it. */
  optional?: boolean;
}

export interface RoadmapPhase {
  id: string;
  title: string;
  /** What is true when this phase is finished. */
  outcome: string;
  /** Who can pass over it. */
  skipIf: string;
  /** Starting points for which this phase begins marked as already behind the student. */
  behindFor: RoadmapStart[];
  /** Runs alongside the others and never holds up "your next step". */
  parallel?: boolean;
  steps: RoadmapStep[];
}

export const STARTS: { id: RoadmapStart; label: string; detail: string }[] = [
  { id: "idea", label: "I don't have a product yet", detail: "Start at the beginning: pick a market and a product." },
  { id: "product", label: "I have a product but I'm not selling yet", detail: "Skip product selection. Start at sourcing and margins." },
  { id: "selling", label: "I'm selling, under $50K a month", detail: "Skip product, sourcing and company setup. Start by connecting your store, then sharpen message, funnel and ads." },
  { id: "scaling", label: "I'm selling, over $50K a month", detail: "Skip the build. Connect your store, get your numbers and weekly rhythm in place, then audit the rest." },
];

// Knowledge Base lesson ids.
const L = {
  introDR: "762957ae-d644-487e-8613-ec96d7d2b0b7", keyPrinciples: "15314b54-61a5-433c-ba96-95f354bc7e7b", aiShift: "9efefc6f-f769-48e4-8d2e-0b9672160c72", goldRush: "a57e0eae-fb24-42bd-af48-b15f035157df",
  stage1: "b4a75a09-1e27-475a-8b2f-589a4e29110a", stage2: "8549bfa7-3147-420f-8f1d-fee53da7a89d", stage3: "81c42f6e-6a46-469d-890f-75fa14c31a42", stage4: "46858340-f727-4c22-bab2-9bd541222514",
  drOS: "f994d582-7a14-450a-8a16-9bd065515506",
  biology: "7f754190-3914-4f2b-86ef-8349bda17e23", saturation: "7381d424-cbbc-4993-a432-6eae7ccfa36f", manus: "146272c7-b9a6-47dc-8282-b3898400a8b8", applyResearch: "3cc9fc2e-6a33-4177-86a8-dc52ef6a13f0", selfAssess: "0eba1038-b742-45b9-89e5-d6e99282fcda",
  umDefine: "5f7fffc9-819e-416b-844e-a1aec27c441a", umCanBe: "5f293f23-7064-4196-8f4e-84e38a2344ea", umFind: "881f73a5-d50a-43b5-96fd-ed085cc625de", understandProduct: "d88cc9b1-839b-4131-9b22-2982e1433abb",
  findAvatars: "a304a304-73e2-4839-9b63-f787f361c058", avatarChecklist: "6f4321bb-2011-418d-9645-a9f658364eac",
  margin85: "100bbb49-2418-471a-89bd-e964dd8dbf19", alibaba: "5b5c9557-33ed-4d4a-8f9d-a1ffdc75c3bd", negotiation: "1c5f5488-5e5b-4dae-aff7-db4c1de2ca53", threePL: "6197bf5e-ecd5-4dc7-9621-299660207c7e",
  llc: "12cfdd59-1ffa-4190-8010-7024f996f4f7", usAddress: "2996dd96-0ab8-411a-8b21-a7e4aea083c9", legalStructure: "ff69de88-5946-4fe7-ab41-ad894ec288b1", bank: "6865aa0c-926b-410e-9116-249b2dd6a583", processing: "0468365f-c5dd-4cec-9105-fcab11bd50d6", paypal: "f0faf4ef-5418-4857-bb14-56d66a7ba4ec", chargeback: "3b834268-b859-489b-b0ec-1f0eb7380236", cardStack: "eeb90cd1-284f-4d85-83b8-4e4563118611", usCredit: "4df96c53-bb81-424d-a670-b630cf584370",
  checklist: "4c9dc8f7-554c-492e-a15c-389b776d835e", shopifyApps: "843db324-4e41-47a7-a605-cde86c2970a5", checkoutChamp: "b9ced815-fab9-45f1-b7e4-6fb2c96d1c52",
  awareness: "058edd09-ba4d-40a9-b090-46e22e2bddaf", focus: "9516cf30-1971-4b7a-b269-99b22bb90e5e", angleDef: "753c8277-21f7-4c0f-a085-03263a8ce973", angleResearch: "c17cab67-ad71-4bdb-bc9b-2fa8b5b447b6", positioning: "747bc52a-436e-48ae-9858-bcf696d5c2ed", positioningEx: "53df860d-2b5e-466c-a349-8986a71615cc",
  funnelIntro: "3cdb4b38-dc92-4fb1-9ee1-f263fe2e3022", funnelSystem: "15ef96a0-25ea-4b06-81f0-a679870c7bfe", advPrinciples: "e4e11fe5-a74b-4fac-9e60-0da837c16c23", advWriting: "f4009f0d-c3be-42c6-862f-e8c4aaa614bb", pdp: "c389d473-e791-40e4-8c67-d7a18a7c5397",
  valueEq: "d00079b2-dcf2-41c4-9aee-afcc6097d34b", offerTypes: "d1097ce6-e133-4691-8e67-150ffd2113ba", rpv: "e7c5aeb1-6346-48ad-91b2-8d48656bd12f",
  ppuWhat: "fb680bbf-94f4-421d-a05e-f539c5ad1271", ppuTypes: "71d3fafa-6567-4792-98ba-1dc744427bdf", ppuScript: "fba2b6e2-d3dd-476d-9ae8-35199e72b2a2", ppuDesign: "9647b8f0-7af4-4de9-a77f-7bdfcf8f9f1c",
  staticsDominate: "528f814b-0950-4a96-97f5-81fe063a6911", staticsScratch: "5fae4954-3676-4237-842b-ab6e2ed5a1aa", staticsGemini: "9c62e34c-aec1-40ed-81e1-10e677e19788", staticsCompetition: "f3161428-b826-432c-bdb1-a67ab42e9a66", staticsReverse: "2615d29e-e7ad-403c-be15-93163a16358a", staticsIterations: "6b063a8b-48be-43bb-8aea-807fcaf87509", staticsTools: "4ee4c2c2-58dc-4810-bd9e-03008605d131",
  metaFund: "7b5d2d7c-6f81-4d41-b64c-720ee24d701f", mediaBuyingDead: "b720d200-5984-427e-8ded-6e6296a47614", kpis: "b45dcce3-84d1-4a16-bbb7-ae183b664858", cbo: "47aebe11-8ae4-48d9-8ebb-bba84303bc73", whitelist: "91f1f9ed-3b76-4709-a464-d448fef97b84",
  vSkeleton: "b5c2af0a-1acb-4e5f-838f-5c8a7f5e9949", vYapper: "a9ecad44-1672-4a5d-9b06-cf8c23d9d4f9", vUgc: "ae794665-060b-417b-b89e-de466f07143b", vReasons: "fb4b212a-0684-45fd-a6eb-d085660b6064", vFounder: "7062b61d-78f9-4a22-8c0f-cdc7d72b60b8", vAuthority: "bc9eb36e-6a6f-4b05-b504-3e469f84bd35", vVsl: "9ffea3ab-dd9e-4132-a0f8-0cc6f938929d", vDrama: "a108e65f-542a-4cd8-8af0-bf7119f80de3", vSong: "875d0689-2ce6-4493-84d7-f6a6d74d2c0e", vExplainer: "b37a3742-d9ae-4458-864a-524670a9fdf0", vClay: "a03c692d-300c-4cb6-8cee-c85ef91bd3fa", vObject: "daf3a34d-01d3-479d-9bd5-b519dd38befa",
  feedbackLoops: "f175025f-e427-46c4-b34d-ecb64ec4ddd5",
  lieOfScale: "6dfee340-b490-444f-8e9d-8f9f19018c56", antiOrg: "bb9766eb-df2d-4dce-8ec8-fb4eb781005a", hiringTrap: "993a5829-c749-426c-b400-0d644bfe4269", teamStructure: "e61dfdfc-aad8-42c9-9c76-af3e6146d192",
  csObjectives: "03509938-02c5-4c6d-9065-951a57b217b8", csTemplates: "2b3df5b1-3a0b-4876-ba9b-f755eddda601", csTools: "b8ec8b95-8bad-4248-bf28-90435d9eb9ba", disputes: "f0c3905c-2bc4-465f-af38-f3191aad16a9",
  mLetter: "34c15372-0f7e-4e3f-8b27-337ec3dc7563", mVivid: "4bfb213a-8c52-4a89-9a47-ffe3e71b1dd5", mRitual: "3122b48c-6626-40c0-93d3-43b48ba1c2a0", mScience: "b5ca717e-dbda-40e5-a7d6-c5b25bebef84", mFear: "3ee869ba-bd61-4355-ad6e-a399378c74ac", mLevers: "5bc6fbfe-b33b-43e4-8743-b37f1b0d1033", mCrisis: "6d4f0a63-cb1e-4569-a966-e6da30acf715", mCreating: "57fea7fb-72f8-4983-a41d-9ba8e222779c", mBrainwash: "8b263426-6f27-4224-8e53-600aedebb5c9", mPendulums: "4422e53b-9e8a-4d37-a76f-702f19da7b47", mPerfection: "9c5884a4-b90d-44d7-985e-4700e8a13ca1",
};

export const ROADMAP: RoadmapPhase[] = [
  {
    id: "orient",
    title: "Get oriented",
    outcome: "You know how this model works, which stage you are in, and what to ignore for now.",
    skipIf: "Nobody. It is an hour, and everything after it assumes it.",
    behindFor: [],
    steps: [
      { id: "orient-dr", title: "Learn how direct response ecommerce works", why: "The rest of the course is built on these principles.", lessons: [L.introDR, L.keyPrinciples, L.aiShift, L.goldRush], doneWhen: "You have read the four lessons." },
      { id: "orient-stage", title: "Find your stage", why: "Each stage has one job. Doing a later stage's work early is the most common way to stall.", lessons: [L.stage1, L.stage2, L.stage3, L.stage4], doneWhen: "You can say which stage you are in and what its one job is." },
      { id: "orient-os", title: "Read: your direct response operating system", why: "How research, message, funnel and ads fit together, before you start any of them.", lessons: [L.drOS], doneWhen: "You have read the lesson." },
    ],
  },
  {
    id: "product",
    title: "Choose your market and product",
    outcome: "One product, a believable mechanism behind it, and a clear picture of who buys it.",
    skipIf: "You already have a product you are committed to. Do the Brand Book step anyway: every later phase reads from it.",
    behindFor: ["product", "selling", "scaling"],
    steps: [
      { id: "product-market", title: "Understand what makes a market profitable", why: "So you pick a market that can carry paid ads, not one that only looks busy.", lessons: [L.biology, L.saturation], doneWhen: "You have read both lessons." },
      { id: "product-research", title: "Research products", why: "A repeatable way to find candidates, and a checklist to judge them against.", lessons: [L.manus, L.applyResearch, L.selfAssess], doneWhen: "You have a shortlist and have run it through the self-assessment checklist." },
      { id: "product-mechanism", title: "Define your unique mechanism", why: "The believable \"how\" is what lets you charge more and be chosen over a cheaper copy.", lessons: [L.umDefine, L.umCanBe, L.umFind, L.understandProduct], tool: { href: "/brand-book", label: "Brand Book" }, doneWhen: "Your mechanism is written in your Brand Book.", auto: (s) => s.mechanism },
      { id: "product-avatar", title: "Define who you are selling to", why: "Every ad, page and offer is written to one of these people.", lessons: [L.findAvatars, L.avatarChecklist], tool: { href: "/brand-book", label: "Brand Book" }, doneWhen: "At least one avatar is in your Brand Book.", auto: (s) => s.avatars > 0 },
    ],
  },
  {
    id: "source",
    title: "Source it and make the margin work",
    outcome: "A supplier, a landed cost, and a price that clears the 85% margin rule.",
    skipIf: "You have stock and know your landed cost. Still enter your costs in Unit Economics: the Forecast and Weekly Review depend on them.",
    behindFor: ["selling", "scaling"],
    steps: [
      { id: "source-margin", title: "Learn the 85% margin rule", why: "Below it, paid acquisition does not pay for itself.", lessons: [L.margin85], doneWhen: "You have read the lesson." },
      { id: "source-supplier", title: "Find and negotiate with a supplier", why: "Your landed cost is set here, and it decides your margin for good.", lessons: [L.alibaba, L.negotiation], tool: { href: "/inventory", label: "Inventory" }, doneWhen: "A supplier with a lead time and minimum order is on your Inventory page.", auto: (s) => s.suppliers > 0 },
      { id: "source-3pl", title: "Decide how orders get shipped", why: "Fulfillment cost per order goes straight into your margin.", lessons: [L.threePL], doneWhen: "You know who ships your orders and what it costs per order." },
      { id: "source-ue", title: "Enter your products, costs and offer", why: "This is what tells you the most you can pay for a customer.", tool: { href: "/unit-economics", label: "Unit Economics" }, doneWhen: "At least one product and one offer are set up, and you can see your allowable cost per customer.", auto: (s) => s.products > 0 && s.offers > 0 },
    ],
  },
  {
    id: "company",
    title: "Set up the company and the money",
    outcome: "A legal entity, a bank account, and a way to take payments that will not get shut off.",
    skipIf: "You are already taking card payments through your own entity. Check the chargeback step either way.",
    behindFor: ["selling", "scaling"],
    steps: [
      { id: "company-entity", title: "Form the company", why: "Banks and payment processors need it before anything else can open.", lessons: [L.legalStructure, L.llc, L.usAddress], doneWhen: "Your entity is registered." },
      { id: "company-bank", title: "Open the bank account", why: "Where revenue lands and suppliers get paid from.", lessons: [L.bank], doneWhen: "The account is open." },
      { id: "company-payments", title: "Set up payment processing and PayPal", why: "Set up wrong, this is what freezes a growing brand's cash.", lessons: [L.processing, L.paypal], doneWhen: "You can take a card payment and a PayPal payment." },
      { id: "company-chargebacks", title: "Turn on chargeback alerts", why: "Alerts let you refund before a dispute counts against your account.", lessons: [L.chargeback], doneWhen: "Alerts are live on your processor." },
      { id: "company-cards", title: "Build your card stack", why: "Ad spend on the right cards is float and cash back.", lessons: [L.cardStack, L.usCredit], doneWhen: "You have the cards you will run ad spend on.", optional: true },
    ],
  },
  {
    id: "connect",
    title: "Set up your store and connect your data",
    outcome: "Your store has the right apps, and this platform is reading your numbers on its own.",
    skipIf: "Nobody skips the connections. They are what fill in your Forecast, Inventory and Weekly Review without typing.",
    behindFor: [],
    steps: [
      { id: "connect-apps", title: "Install the apps you need", why: "The short list that matters, and what to leave out.", lessons: [L.checklist, L.shopifyApps, L.checkoutChamp], doneWhen: "The apps on the checklist are installed." },
      { id: "connect-shopify", title: "Connect Shopify", why: "Orders, products and stock arrive on their own.", tool: { href: "/integrations", label: "Connections" }, doneWhen: "Shopify shows as connected.", auto: (s) => s.connected.shopify },
      { id: "connect-tw", title: "Connect Triple Whale", why: "Ad spend, new customers and NC-ROAS, as one source of truth.", tool: { href: "/integrations", label: "Connections" }, doneWhen: "Triple Whale shows as connected.", auto: (s) => s.connected.tripleWhale },
      { id: "connect-lt", title: "Connect Lifetimely", why: "Repeat purchase and lifetime value by cohort.", tool: { href: "/integrations", label: "Connections" }, doneWhen: "Lifetimely shows as connected.", auto: (s) => s.connected.lifetimely, optional: true },
      { id: "connect-meta", title: "Connect Meta", why: "Lets the Creative page read every ad's results.", tool: { href: "/integrations", label: "Connections" }, doneWhen: "Meta shows as connected.", auto: (s) => s.connected.meta },
    ],
  },
  {
    id: "message",
    title: "Build your message",
    outcome: "You know which awareness level you are selling to, the angles you will test, and how you are positioned.",
    skipIf: "You have angles that are already winning. Record them in the Brand Book so the Creative page can group results by them.",
    behindFor: [],
    steps: [
      { id: "message-awareness", title: "Learn the five levels of awareness", why: "It decides how much explaining an ad has to do.", lessons: [L.awareness, L.focus], doneWhen: "You know which level you are writing for first." },
      { id: "message-angles", title: "Find and validate your angles", why: "Angles are what you actually test. Creative is just how each one is delivered.", lessons: [L.angleDef, L.angleResearch], tool: { href: "/brand-book", label: "Brand Book" }, doneWhen: "At least one angle is in your Brand Book.", auto: (s) => s.angles > 0 },
      { id: "message-positioning", title: "Set your positioning", why: "Why you, against everything else the buyer has already tried.", lessons: [L.positioning, L.positioningEx], doneWhen: "You can state your positioning in one sentence." },
    ],
  },
  {
    id: "funnel",
    title: "Build the funnel",
    outcome: "A pre-sale page, a product page, an offer and a post-purchase upsell, ready for cold traffic.",
    skipIf: "Your funnel already converts cold traffic profitably. Even then, check the upsell step: it is the cheapest lift in order value there is.",
    behindFor: [],
    steps: [
      { id: "funnel-system", title: "Learn how the funnel is tested", why: "Most \"bad ads\" are a funnel problem.", lessons: [L.funnelIntro, L.funnelSystem], doneWhen: "You have read both lessons." },
      { id: "funnel-presale", title: "Write your pre-sale page", why: "It does the selling a cold visitor needs before they see a price.", lessons: [L.advPrinciples, L.advWriting], resource: { href: "/resources/pre-sales", label: "Pre-Sales Vault" }, doneWhen: "Your advertorial is live." },
      { id: "funnel-pdp", title: "Build your product page", why: "The page that takes the order.", lessons: [L.pdp], doneWhen: "Your product page follows the formula and is live." },
      { id: "funnel-offer", title: "Structure your offer", why: "The offer moves revenue per visitor more than the page does.", lessons: [L.valueEq, L.offerTypes, L.rpv], tool: { href: "/unit-economics", label: "Unit Economics" }, doneWhen: "Your offer is entered in Unit Economics and clears the margin rule.", auto: (s) => s.offers > 0 },
      { id: "funnel-upsell", title: "Add a post-purchase upsell", why: "Extra order value from a customer who has already paid.", lessons: [L.ppuWhat, L.ppuTypes, L.ppuScript, L.ppuDesign], resource: { href: "/resources/post-purchase", label: "Post-Purchase Upsell Vault" }, tool: { href: "/unit-economics", label: "Unit Economics" }, doneWhen: "An upsell is live and entered in Unit Economics.", auto: (s) => s.upsells > 0 },
    ],
  },
  {
    id: "creative",
    title: "Make your first ads",
    outcome: "A batch of static and video ads, one per angle, named so their results can be read.",
    skipIf: "You are already launching new ads every week. Check that your ad names follow the convention in your Brand Book.",
    behindFor: [],
    steps: [
      { id: "creative-statics", title: "Make static ads", why: "The fastest, cheapest way to test an angle.", lessons: [L.staticsDominate, L.staticsCompetition, L.staticsReverse, L.staticsScratch, L.staticsGemini, L.staticsTools], doneWhen: "You have at least five statics ready, across two or more angles." },
      { id: "creative-video", title: "Make your first video ads", why: "Start with one or two formats. The other SOPs are there when you need them.", lessons: [L.vSkeleton, L.vYapper, L.vUgc, L.vReasons, L.vFounder, L.vAuthority, L.vVsl, L.vDrama, L.vSong, L.vExplainer, L.vClay, L.vObject], doneWhen: "You have followed one SOP end to end and have a finished video. You do not need to read them all." },
      { id: "creative-iterate", title: "Learn how to iterate on a winner", why: "Most of your spend will end up on variations of a few winners.", lessons: [L.staticsIterations], doneWhen: "You have read the lesson.", optional: true },
    ],
  },
  {
    id: "ads",
    title: "Launch and read your ads",
    outcome: "A campaign is live and you know which numbers decide what happens next.",
    skipIf: "You are already spending on Meta. Read the KPIs lesson so your numbers mean the same thing ours do.",
    behindFor: [],
    steps: [
      { id: "ads-fundamentals", title: "Learn how Meta ads work now", why: "The account structure is simple. The creative does the targeting.", lessons: [L.metaFund, L.mediaBuyingDead, L.kpis], doneWhen: "You have read the three lessons." },
      { id: "ads-launch", title: "Launch your first campaign", why: "Nothing is validated until it has spend behind it.", lessons: [L.cbo, L.whitelist], doneWhen: "Your campaign is live and spending.", auto: (s) => s.hasAdSpend },
      { id: "ads-read", title: "Read your results by angle and format", why: "This is where you find out what to make more of.", tool: { href: "/creative", label: "Creative" }, doneWhen: "Ads you launched appear on your Creative page.", auto: (s) => s.adsLaunched },
    ],
  },
  {
    id: "operate",
    title: "Run the business every week",
    outcome: "You know where your cash and stock will be, and you review the business once a week on the same numbers.",
    skipIf: "Nobody with revenue. This is the phase that replaces asking us how things are going.",
    behindFor: [],
    steps: [
      { id: "operate-forecast", title: "Set up your Forecast", why: "Shows the week you would run out of cash before you get there.", tool: { href: "/forecast", label: "Forecast" }, doneWhen: "You have filled in the gold fields in Quick setup and saved.", auto: (s) => s.forecastSaved },
      { id: "operate-inventory", title: "Set up Inventory", why: "Tells you when to reorder so ads never run into an empty shelf.", tool: { href: "/inventory", label: "Inventory" }, doneWhen: "Each product has a supplier lead time and you can see a reorder date.", auto: (s) => s.suppliers > 0 },
      { id: "operate-targets", title: "Set your targets on the Weekly Review", why: "A target turns a number into on target or missed, so the review runs by exception.", lessons: [L.feedbackLoops], tool: { href: "/wbr", label: "Weekly Review" }, doneWhen: "At least three scorecard rows have a target.", auto: (s) => s.wbrTargets >= 3 },
      { id: "operate-review", title: "Run your first weekly review", why: "Thirty minutes, once a week: what missed, why, and what you will do about it.", tool: { href: "/wbr?tab=agenda", label: "Run of show" }, doneWhen: "You have followed the run of show once and put at least one task on the Board.", auto: (s) => s.wbrItems > 0 },
    ],
  },
  {
    id: "scale",
    title: "Scale and build the team",
    outcome: "The work that does not need you is off your plate, without hiring ahead of the business.",
    skipIf: "You are under $50K a month. Hiring before validation is the trap; come back when the Weekly Review says you are the bottleneck.",
    behindFor: ["idea", "product"],
    steps: [
      { id: "scale-team", title: "Decide who to hire, and when", why: "Most early hires are made to relieve a feeling, not a constraint.", lessons: [L.lieOfScale, L.antiOrg, L.hiringTrap, L.teamStructure], doneWhen: "You know your next hire and the trigger for making it." },
      { id: "scale-support", title: "Set up customer service", why: "Support is where refunds and chargebacks are won or lost.", lessons: [L.csObjectives, L.csTemplates, L.csTools, L.disputes], tool: { href: "/integrations", label: "Connections" }, doneWhen: "Your answer templates are in place and your support desk is connected.", auto: (s) => s.connected.commslayer },
      { id: "scale-stages", title: "Re-read your next stage", why: "The job changes at each stage, and so does what you should stop doing.", lessons: [L.stage3, L.stage4], doneWhen: "You have read the lesson for the stage ahead of you.", optional: true },
    ],
  },
  {
    id: "mindset",
    title: "Operator mindset",
    outcome: "A steady track alongside the build. One lesson a week is plenty.",
    skipIf: "Take it at your own pace. It never holds up your next step.",
    behindFor: [],
    parallel: true,
    steps: [
      { id: "mindset-identity", title: "The identity shift", why: "Start here.", lessons: [L.mLetter, L.mVivid, L.mRitual], doneWhen: "You have read the three lessons." },
      { id: "mindset-rest", title: "The rest of the series", why: "Read in order, one at a time.", lessons: [L.mScience, L.mFear, L.mLevers, L.mCrisis, L.mCreating, L.mBrainwash, L.mPendulums, L.mPerfection], doneWhen: "You have read them." },
    ],
  },
];

// ---- Evaluation --------------------------------------------------------------

export type StepStatus = "done" | "skipped" | "todo";
export interface StepView { step: RoadmapStep; status: StepStatus; auto: boolean; lessons: { id: string; title: string; done: boolean }[] }
export interface PhaseView { phase: RoadmapPhase; index: number; behind: boolean; skipped: boolean; steps: StepView[]; done: number; total: number; complete: boolean }
export interface RoadmapView { phases: PhaseView[]; next: { phase: PhaseView; step: StepView } | null; done: number; total: number }

/**
 * Works out where a brand stands. A step is done when its data check passes, when it was ticked by
 * hand, or — for a step that is only reading — when every lesson in it is complete. A phase the
 * starting point puts behind the student is skipped unless they reopen it; optional steps and the
 * parallel track never become "your next step".
 */
export function evaluateRoadmap(state: RoadmapState, sig: RoadmapSignals, lessonTitles: Map<string, string>): RoadmapView {
  let n = 0;
  const phases = ROADMAP.map<PhaseView>((phase) => {
    const behind = state.start != null && phase.behindFor.includes(state.start) && !state.reopened[phase.id];
    const skipped = behind || Boolean(state.skipped[phase.id]);
    const steps = phase.steps.map<StepView>((step) => {
      const lessons = (step.lessons ?? []).filter((id) => lessonTitles.has(id)).map((id) => ({ id, title: lessonTitles.get(id)!, done: sig.lessonsDone.has(id) }));
      const auto = Boolean(step.auto?.(sig));
      const readOnly = !step.auto && !step.tool && lessons.length > 0;
      const done = auto || Boolean(state.done[step.id]) || (readOnly && lessons.every((l) => l.done));
      const status: StepStatus = done ? "done" : skipped || state.skipped[step.id] ? "skipped" : "todo";
      return { step, status, auto, lessons };
    });
    const counted = steps.filter((s) => s.status !== "skipped");
    const done = counted.filter((s) => s.status === "done").length;
    const index = phase.parallel ? 0 : ++n;
    return { phase, index, behind, skipped, steps, done, total: counted.length, complete: counted.length > 0 ? done === counted.length : skipped };
  });
  let next: RoadmapView["next"] = null;
  for (const p of phases) {
    if (p.phase.parallel || p.skipped) continue;
    const s = p.steps.find((x) => x.status === "todo" && !x.step.optional);
    if (s) { next = { phase: p, step: s }; break; }
  }
  const main = phases.filter((p) => !p.phase.parallel);
  return { phases, next, done: main.reduce((a, p) => a + p.done, 0), total: main.reduce((a, p) => a + p.total, 0) };
}
