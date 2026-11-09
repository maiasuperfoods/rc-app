export const fmtD = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDT = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const money = (n: number | string | null | undefined) => (n === null || n === undefined || n === "" ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }));
export const pct = (n: number | string | null | undefined) => (n === null || n === undefined || n === "" ? "—" : Number(n).toFixed(1).replace(/\.0$/, "") + "%");
export const plain = (n: number | string | null | undefined) => (n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString("en-US"));
export const fmtFor = (unit: string | null | undefined) => (unit === "usd" ? money : unit === "pct" ? pct : plain);
export const srcLabel = (source: string | null | undefined) => (source === "intake" ? "intake" : source?.startsWith("call") ? "call" : source?.startsWith("checkin") ? "check-in" : source || "");
