import { cn } from "../lib/utils";

export const RISK_STYLES = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Low: "bg-green-500/10 text-green-400 border-green-500/30",
};

export const RISK_HEX = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#eab308",
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
    Open: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    "In Progress": "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    Active: "bg-green-500/10 text-green-400 border-green-500/30",
    "Under Investigation": "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Resolved: "bg-green-500/10 text-green-400 border-green-500/30",
    Acknowledged: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    None: "bg-zinc-800 text-zinc-500 border-zinc-700",
  };
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium", map[status] || map.None)}>
      {status}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, accent = "text-blue-400", sub, testid, delay = 0 }) {
  return (
    <div
      data-testid={testid}
      className="fade-up border border-zinc-800 bg-zinc-900/50 p-4 hover:bg-zinc-900 transition-colors"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-500">{label}</p>
          <p className="mt-2 font-mono text-3xl font-bold text-zinc-100">{value}</p>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("border border-zinc-800 bg-zinc-950 p-2", accent)}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-3xl font-black tracking-tight text-zinc-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Loading({ label = "Loading" }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
      <p className="font-mono text-xs uppercase tracking-widest">{label}...</p>
    </div>
  );
}

export function ChartCard({ title, subtitle, children, className, testid }) {
  return (
    <div data-testid={testid} className={cn("border border-zinc-800 bg-zinc-900/50 p-4", className)}>
      <div className="mb-4">
        <h3 className="font-heading text-sm font-bold text-zinc-200">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function chartTooltipStyle() {
  return {
    contentStyle: {
      background: "#18181b",
      border: "1px solid #27272a",
      borderRadius: "4px",
      fontSize: "12px",
      fontFamily: "JetBrains Mono, monospace",
    },
    labelStyle: { color: "#a1a1aa" },
    itemStyle: { color: "#f4f4f5" },
  };
}
