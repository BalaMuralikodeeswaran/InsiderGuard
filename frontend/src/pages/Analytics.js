import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, RadialBarChart, RadialBar,
} from "recharts";
import { Cpu, Target, TrendingUp, Usb, Download, Mail, CircleCheck } from "lucide-react";
import api from "../lib/api";
import { PageHeader, Loading, ChartCard, chartTooltipStyle, StatCard } from "../components/common";

const axisProps = { stroke: "#52525b", tick: { fill: "#a1a1aa", fontSize: 11, fontFamily: "JetBrains Mono" } };
const HEAT = ["#0e1a2e", "#1e3a5f", "#2563eb", "#f59e0b", "#ef4444", "#dc2626"];

export default function Analytics() {
  const [ov, setOv] = useState(null);
  const [model, setModel] = useState(null);

  useEffect(() => {
    (async () => {
      const [o, m] = await Promise.all([api.get("/analytics/overview"), api.get("/analytics/model")]);
      setOv(o.data); setModel(m.data);
    })();
  }, []);

  if (!ov || !model) return <Loading label="Loading analytics" />;
  const tt = chartTooltipStyle();
  const selected = model.selected_model;
  const selModel = (model.models || []).find((m) => m.name === selected) || (model.models || [])[0];
  const heatMax = Math.max(1, ...ov.login_heatmap.flatMap((r) => [r.b0, r.b1, r.b2, r.b3, r.b4, r.b5]));
  const heatColor = (v) => HEAT[Math.min(5, Math.floor((v / heatMax) * 5))];
  const buckets = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics & ML Evaluation" subtitle="Model performance, threat trends and behavioural statistics" />

      {/* Model summary */}
      <div className="border border-blue-500/30 bg-blue-500/5 p-4">
        <div className="flex items-center gap-2 text-blue-400">
          <Cpu size={18} />
          <p className="font-heading text-sm font-bold">Selected Model: <span className="font-mono">{selected}</span></p>
        </div>
        <p className="mt-1 text-xs text-zinc-400">The system compared Isolation Forest and Local Outlier Factor and selected the best performer by F1 score.</p>
      </div>

      {/* ML metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard testid="metric-accuracy" label="Accuracy" value={selModel.accuracy} accent="text-green-400" />
        <StatCard testid="metric-precision" label="Precision" value={selModel.precision} accent="text-blue-400" />
        <StatCard testid="metric-recall" label="Recall" value={selModel.recall} accent="text-cyan-400" />
        <StatCard testid="metric-f1" label="F1 Score" value={selModel.f1} accent="text-fuchsia-400" />
        <StatCard testid="metric-fpr" label="False Positive Rate" value={selModel.false_positive_rate} accent="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Model comparison */}
        <ChartCard testid="model-comparison" title="Model Performance Comparison" subtitle="F1 / precision / recall by algorithm">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={model.models}>
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 1]} />
              <Tooltip {...tt} cursor={{ fill: "#27272a55" }} />
              <Bar dataKey="precision" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="recall" fill="#06b6d4" radius={[2, 2, 0, 0]} />
              <Bar dataKey="f1" fill="#a855f7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#3b82f6]" />Precision</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#06b6d4]" />Recall</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#a855f7]" />F1</span>
          </div>
        </ChartCard>

        {/* Confusion matrix */}
        <ChartCard testid="confusion-matrix" title="Confusion Matrix" subtitle={`${selected} — predicted vs actual`}>
          <div className="flex h-[240px] items-center justify-center">
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "True Negative", v: selModel.confusion_matrix[0][0], c: "bg-green-500/15 text-green-400 border-green-500/30" },
                { l: "False Positive", v: selModel.confusion_matrix[0][1], c: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
                { l: "False Negative", v: selModel.confusion_matrix[1][0], c: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
                { l: "True Positive", v: selModel.confusion_matrix[1][1], c: "bg-red-500/15 text-red-400 border-red-500/30" },
              ].map((c) => (
                <div key={c.l} className={`flex h-24 w-32 flex-col items-center justify-center border ${c.c}`}>
                  <p className="font-mono text-3xl font-bold">{c.v}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider">{c.l}</p>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Feature importance + threats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard testid="feature-importance" title="Feature Importance" subtitle="Correlation with anomaly score">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(model.feature_importance || []).slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
              <XAxis type="number" {...axisProps} domain={[0, 1]} />
              <YAxis type="category" dataKey="feature" {...axisProps} width={130} />
              <Tooltip {...tt} cursor={{ fill: "#27272a55" }} />
              <Bar dataKey="importance" fill="#3b82f6" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard testid="common-threats" title="Most Common Threats" subtitle="Alert descriptions by frequency">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ov.common_threats} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="threat" {...axisProps} width={150} tick={{ fill: "#a1a1aa", fontSize: 9 }} />
              <Tooltip {...tt} cursor={{ fill: "#27272a55" }} />
              <Bar dataKey="count" fill="#ef4444" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Top depts + stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard testid="top-depts" title="Top Risky Departments" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ov.top_departments}>
              <XAxis dataKey="department" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} />
              <Tooltip {...tt} cursor={{ fill: "#27272a55" }} />
              <Bar dataKey="avg_risk" radius={[2, 2, 0, 0]}>
                {ov.top_departments.map((d, i) => <Cell key={i} fill={d.avg_risk >= 61 ? "#ef4444" : d.avg_risk >= 31 ? "#eab308" : "#22c55e"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="grid grid-cols-1 gap-3">
          <StatCard testid="stat-total-downloads" label="Total Downloads" value={ov.download_total.toLocaleString()} icon={Download} accent="text-amber-400" />
          <StatCard testid="stat-total-usb" label="USB Insertions" value={ov.usb_total} icon={Usb} accent="text-fuchsia-400" />
          <StatCard testid="stat-total-email" label="External Emails" value={ov.external_email_total.toLocaleString()} icon={Mail} accent="text-cyan-400" />
          <StatCard testid="stat-fp-rate" label="False Positive Rate" value={`${ov.false_positive_rate}%`} icon={CircleCheck} accent="text-green-400" />
        </div>
      </div>

      {/* Login heatmap */}
      <ChartCard testid="login-heatmap" title="Login Time Heatmap" subtitle="Session intensity by day and time bucket">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="p-1 text-left font-mono text-[10px] text-zinc-500"></th>
                {buckets.map((b) => <th key={b} className="p-1 font-mono text-[10px] text-zinc-500">{b}</th>)}
              </tr>
            </thead>
            <tbody>
              {ov.login_heatmap.map((r) => (
                <tr key={r.day}>
                  <td className="p-1 font-mono text-xs text-zinc-400">{r.day}</td>
                  {[r.b0, r.b1, r.b2, r.b3, r.b4, r.b5].map((v, i) => (
                    <td key={i} className="p-1">
                      <div className="flex h-9 items-center justify-center font-mono text-xs text-white" style={{ background: heatColor(v) }} title={`${v} logins`}>{v || ""}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
