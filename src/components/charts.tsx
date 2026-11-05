"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const gold = "var(--gold)";
const info = "var(--info)";
const good = "var(--good)";
const bad = "var(--bad)";
const PALETTE = { gold, info, good, bad };

const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
const shortDate = (s: string) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function RevenueSpendChart({ data }: { data: { date: string; revenue: number; adSpend: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gold} stopOpacity={0.35} />
            <stop offset="100%" stopColor={gold} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `$${v / 1000}k`} width={44} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(l) => shortDate(String(l))} />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke={gold} fill="url(#rev)" strokeWidth={1.75} isAnimationActive={false} />
        <Line type="monotone" dataKey="adSpend" name="Ad spend" stroke={info} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleLine({ data, x, y, label, format = "money", color = "gold", height = 180 }: { data: Record<string, unknown>[]; x: string; y: string; label: string; format?: "money" | "num" | "x"; color?: keyof typeof PALETTE; height?: number }) {
  const f = (v: number) => (format === "money" ? money(v) : format === "x" ? `${v.toFixed(2)}×` : v.toLocaleString());
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={x} tickFormatter={(s) => (typeof s === "string" && s.length >= 10 ? shortDate(s) : String(s))} minTickGap={40} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => (format === "money" ? `$${v >= 1000 ? `${v / 1000}k` : v}` : String(v))} width={48} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => f(Number(v))} />
        <Line type="monotone" dataKey={y} name={label} stroke={PALETTE[color]} strokeWidth={1.75} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, x, y, label, color = "gold", height = 160, format = "num" }: { data: Record<string, unknown>[]; x: string; y: string; label: string; color?: keyof typeof PALETTE; height?: number; format?: "money" | "num" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={x} tickFormatter={(s) => (typeof s === "string" && s.length >= 10 ? shortDate(s) : String(s))} axisLine={false} tickLine={false} />
        <YAxis width={40} axisLine={false} tickLine={false} tickFormatter={(v) => (format === "money" ? `$${v / 1000}k` : String(v))} />
        <Tooltip formatter={(v) => (format === "money" ? money(Number(v)) : Number(v).toLocaleString())} />
        <Bar dataKey={y} name={label} fill={PALETTE[color]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashChart({ data }: { data: { month: string; cashEnd: number; net: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} />
        <YAxis width={52} axisLine={false} tickLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
        <Tooltip formatter={(v) => money(Number(v))} />
        <Bar dataKey="net" name="Net cash flow" fill={gold} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <Line type="monotone" dataKey="cashEnd" name="Cash at month end" stroke={good} dot={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
