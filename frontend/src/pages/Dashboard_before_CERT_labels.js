import { useEffect, useState } from "react";
import {
  Users, FileStack, ShieldAlert, Gauge, Search, Radar, RefreshCw, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area, CartesianGrid,
} from "recharts";
import api from "../lib/api";
import { toast } from "sonner";
import { StatCard, PageHeader, Loading, ChartCard, chartTooltipStyle, RISK_HEX } from "../components/common";

const axisProps = { stroke: "#52525b", tick: { fill: "#a1a1aa", fontSize: 11, fontFamily: "JetBrains Mono" } };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    const [s, c] = await Promise.all([api.get("/dashboard/stats"), api.get("/dashboard/charts")]);
    setStats(s.data);
    setCharts(c.data);
  };

  useEffect(() => { load(); }, []);

  const rerun = async () => {
    setAnalyzing(true);
    try {
      await api.post("/analysis/run");
      await load();
      toast.success("ML analysis re-run complete");
    } catch { toast.error("Analysis failed"); }
    finally { setAnalyzing(false); }
  };

  if (!stats || !charts) return <Loading label="Loading SOC data" />;

  const pieData = [
    { name: "Low", value: stats.risk_levels.Low, color: RISK_HEX.Low },
    { name: "Medium", value: stats.risk_levels.Medium, color: RISK_HEX.Medium },
    { name: "High", value: stats.risk_levels.High, color: RISK_HEX.High },
    { name: "Critical", value: stats.risk_levels.Critical, color: RISK_HEX.Critical },
  ].filter((d) => d.value > 0);

  const tt = chartTooltipStyle();

  return (
    <div className="space-y-6">
      <PageHeader title="Security Dashboard" subtitle="Real-time insider threat monitoring overview">
        <button data-testid="rerun-analysis-btn" onClick={rerun} disabled={analyzing}
          className="flex items-center gap-2 border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm text-[#E5E7EB] hover:border-[#374151] disabled:opacity-60">
          {analyzing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Re-run Analysis
        </button>
      </PageHeader>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard testid="stat-total-employees" label="Total Employees" value={stats.total_employees} icon={Users} delay={0} />
        <StatCard testid="stat-total-logs" label="Logs Uploaded" value={stats.total_logs.toLocaleString()} icon={FileStack} accent="text-cyan-400" delay={50} />
        <StatCard testid="stat-critical-alerts" label="Critical Alerts" value={stats.critical_alerts} icon={ShieldAlert} accent="text-red-400" delay={100} />
        <StatCard testid="stat-avg-risk" label="Avg Risk Score" value={stats.avg_risk_score} icon={Gauge} accent="text-amber-400" delay={150} />
        <StatCard testid="stat-investigations" label="Investigations Today" value={stats.investigations_today} icon={Search} accent="text-[#374151]" delay={200} />
        <StatCard testid="stat-anomalies" label="Anomalies Detected" value={stats.anomalies_detected} icon={Radar} accent="text-fuchsia-400" delay={250} />
      </div>

      {/* Risk tier strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "Critical Employees", v: stats.risk_levels.Critical, c: "border-red-500/30 text-red-400" },
          { l: "High Risk", v: stats.risk_levels.High, c: "border-amber-500/30 text-amber-400" },
          { l: "Medium Risk", v: stats.risk_levels.Medium, c: "border-yellow-500/30 text-yellow-400" },
          { l: "Low Risk", v: stats.risk_levels.Low, c: "border-green-500/30 text-green-400" },
        ].map((t) => (
          <div key={t.l} className={`border ${t.c} bg-[#111827]/10 p-4`}>
            <p className="font-mono text-xs uppercase tracking-widest text-[#E5E7EB]/55">{t.l}</p>
            <p className="mt-1 font-mono text-2xl font-bold">{t.v}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard testid="chart-risk-dist" title="Risk Score Distribution" subtitle="Employees per risk band" className="lg:col-span-1">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="#0B0F19">
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...tt} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-[#E5E7EB]/70">
                <span className="h-2.5 w-2.5" style={{ background: d.color }} /> {d.name} ({d.value})
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard testid="chart-dept-risk" title="Department Risk Comparison" subtitle="Average risk score by department" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.department_risk} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" {...axisProps} domain={[0, 100]} />
              <YAxis type="category" dataKey="department" {...axisProps} width={90} />
              <Tooltip {...tt} cursor={{ fill: "#1F293755" }} />
              <Bar dataKey="avg_risk" radius={[0, 2, 2, 0]}>
                {charts.department_risk.map((d, i) => (
                  <Cell key={i} fill={d.avg_risk >= 61 ? RISK_HEX.High : d.avg_risk >= 31 ? RISK_HEX.Medium : RISK_HEX.Low} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Monthly security incident trend */}
      <ChartCard testid="chart-monthly-incidents" title="Monthly Security Incidents" subtitle="Detected incidents by severity over the last 6 months">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={charts.monthly_incidents}>
            <defs>
              <linearGradient id="gm-crit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gm-high" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gm-med" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#eab308" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tt} />
            <Area type="monotone" dataKey="medium" stackId="1" stroke="#eab308" strokeWidth={2} fill="url(#gm-med)" />
            <Area type="monotone" dataKey="high" stackId="1" stroke="#f59e0b" strokeWidth={2} fill="url(#gm-high)" />
            <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" strokeWidth={2} fill="url(#gm-crit)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 text-xs text-[#E5E7EB]/70">
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#ef4444]" />Critical</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#f59e0b]" />High</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#eab308]" />Medium</span>
        </div>
      </ChartCard>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard testid="chart-daily-suspicious" title="Daily Suspicious Activity" subtitle="Flagged sessions per day (14d)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={charts.daily_suspicious}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tt} />
              <Area type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard testid="chart-login-time" title="Login Time Analysis" subtitle="Session count by hour of day">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.login_time}>
              <XAxis dataKey="hour" {...axisProps} interval={3} />
              <YAxis {...axisProps} />
              <Tooltip {...tt} cursor={{ fill: "#1F293755" }} />
              <Bar dataKey="logins" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard testid="chart-download-trend" title="File Download Trends" subtitle="Total downloads/day">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={charts.download_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
              <XAxis dataKey="date" {...axisProps} interval={2} />
              <YAxis {...axisProps} />
              <Tooltip {...tt} />
              <Line type="monotone" dataKey="downloads" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard testid="chart-usb-trend" title="USB Usage Statistics" subtitle="USB insertions/day">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={charts.usb_trend}>
              <XAxis dataKey="date" {...axisProps} interval={2} />
              <YAxis {...axisProps} />
              <Tooltip {...tt} cursor={{ fill: "#1F293755" }} />
              <Bar dataKey="usb" fill="#a855f7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard testid="chart-email-trend" title="External Email Activity" subtitle="External emails/day">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={charts.email_trend}>
              <defs>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" {...axisProps} interval={2} />
              <YAxis {...axisProps} />
              <Tooltip {...tt} />
              <Area type="monotone" dataKey="external" stroke="#06b6d4" strokeWidth={2} fill="url(#g2)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
