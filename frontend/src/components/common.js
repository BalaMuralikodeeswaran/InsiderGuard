import { cn } from "../lib/utils";

export const RISK_STYLES = {
  Critical: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/40",
  High: "bg-[#f97316]/10 text-[#f97316] border-[#f97316]/40",
  Medium: "bg-[#facc15]/10 text-[#facc15] border-[#facc15]/40",
  Low: "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/40",
};

export const RISK_HEX = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#e1d18e",
  Low: "#22c55e",
};

export function RiskBadge({ level, testid }) {
  return (
    <span
      data-testid={testid}
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-mono font-semibold uppercase tracking-wider",
        RISK_STYLES[level] || RISK_STYLES.Low
      )}
    >
      {level}
    </span>
  );
}

export function SeverityBadge({ severity, testid }) {
  return <RiskBadge level={severity} testid={testid} />;
}

export function StatusPill({ status }) {
  const map = {
    Open: "bg-[#111827]/30 text-[#374151] border-[#374151]/40",
    "In Progress": "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Closed: "bg-zinc-500/10 text-[#E5E7EB]/70 border-zinc-500/30",
    Active: "bg-green-500/10 text-green-400 border-green-500/30",
    "Under Investigation": "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Resolved: "bg-green-500/10 text-green-400 border-green-500/30",
    Acknowledged: "bg-[#111827]/30 text-[#374151] border-[#374151]/40",
    None: "bg-[#1F2937] text-[#E5E7EB]/55 border-[#1F2937]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium", map[status] || map.None)}>
      {status}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, accent = "text-[#374151]", sub, testid, delay = 0 }) {
  return (
    <div
      data-testid={testid}
      className="fade-up border border-[#1F2937] bg-[#111827]/10 p-4 hover:bg-[#0B0F19] transition-colors"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-[#E5E7EB]/55">{label}</p>
          <p className="mt-2 font-mono text-3xl font-bold text-[#E5E7EB]">{value}</p>
          {sub && <p className="mt-1 text-xs text-[#E5E7EB]/55">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("border border-[#1F2937] bg-[#0B0F19] p-2", accent)}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#1F2937] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-3xl font-black tracking-tight text-[#E5E7EB]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#E5E7EB]/70">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Loading({ label = "Loading" }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-[#E5E7EB]/55">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1F2937] border-t-[#374151]" />
      <p className="font-mono text-xs uppercase tracking-widest">{label}...</p>
    </div>
  );
}

export function ChartCard({ title, subtitle, children, className, testid }) {
  return (
    <div data-testid={testid} className={cn("border border-[#1F2937] bg-[#111827]/10 p-4", className)}>
      <div className="mb-4">
        <h3 className="font-heading text-sm font-bold text-[#E5E7EB]">{title}</h3>
        {subtitle && <p className="text-xs text-[#E5E7EB]/55">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function chartTooltipStyle() {
  return {
    contentStyle: {
      background: "#111827",
      border: "1px solid #1F2937",
      borderRadius: "4px",
      fontSize: "12px",
      fontFamily: "JetBrains Mono, monospace",
    },
    labelStyle: { color: "#a1a1aa" },
    itemStyle: { color: "#f4f4f5" },
  };
}
