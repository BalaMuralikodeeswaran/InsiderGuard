import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Upload, Users, ShieldAlert, Search, FileText, BarChart3,
  Bell, Settings, UserCog, LogOut, ShieldCheck, Activity, Info, HelpCircle,
  ChevronRight, X, Siren, CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { cn } from "../lib/utils";
import { RiskBadge } from "./common";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload Logs", icon: Upload },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/alerts", label: "Alerts", icon: ShieldAlert },
  { to: "/investigations", label: "Investigations", icon: Search },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/users", label: "User Management", icon: UserCog, admin: true },
  { to: "/settings", label: "Settings", icon: Settings, admin: true },
];

const SECONDARY = [
  { to: "/profile", label: "Profile", icon: UserCog },
  { to: "/help", label: "Help", icon: HelpCircle },
  { to: "/about", label: "About", icon: Info },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const sinceRef = useRef(null);
  const searchRef = useRef(null);
  const audioCtxRef = useRef(null);

  // ---- Siren chime (Web Audio API, no asset needed) ----
  const playSiren = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.connect(gain);
      // two-tone siren sweep
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(1320, now + 0.22);
      osc.frequency.linearRampToValueAtTime(880, now + 0.44);
      osc.frequency.linearRampToValueAtTime(1320, now + 0.66);
      osc.frequency.linearRampToValueAtTime(880, now + 0.88);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {}
  };

  const loadUnread = async () => {
    try {
      const { data } = await api.get("/notifications");
      setUnread(data.unread);
    } catch {}
  };

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 20000);
    return () => clearInterval(t);
  }, []);

  // ---- Live Critical Alert Stream ----
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const { data } = await api.get(`/alerts/stream${sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : ""}`);
        if (!active) return;
        if (sinceRef.current && data.new_critical?.length) {
          playSiren();
          data.new_critical.forEach((n) => {
            toast.error(n.message, { icon: "🚨", duration: 8000, description: "Critical insider-threat alert" });
          });
          setLiveAlerts((prev) => [...data.new_critical, ...prev].slice(0, 5));
        }
        sinceRef.current = data.server_time; // advance watermark
      } catch {}
    };
    poll(); // establishes initial watermark (no toast on first run)
    const t = setInterval(poll, 8000);
    return () => { active = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setResults(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const visibleNav = NAV.filter((n) => !n.admin || user?.role === "admin");

  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-[#E5E7EB]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[#1F2937] bg-[#111827]/10 lg:flex">
        <div className="flex items-center gap-2 border-b border-[#1F2937] px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center bg-[#374151]">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <p className="font-heading text-sm font-black leading-none tracking-tight">CaughtIn4K</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#E5E7EB]/55">SOC Console</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#E5E7EB]/40">Monitoring</p>
          {visibleNav.map((n) => (
            <NavItem key={n.to} n={n} badge={n.to === "/notifications" ? unread : 0} />
          ))}
          <p className="px-2 pb-2 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#E5E7EB]/40">Account</p>
          {SECONDARY.map((n) => (
            <NavItem key={n.to} n={n} />
          ))}
        </nav>
        <div className="border-t border-[#1F2937] p-3">
          <div className="flex items-center gap-3 rounded-sm bg-[#0B0F19] p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#111827]/40 font-mono text-xs font-bold text-[#374151]">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="truncate font-mono text-[10px] uppercase text-[#E5E7EB]/55">{user?.role}</p>
            </div>
            <button data-testid="logout-btn" onClick={doLogout} className="text-[#E5E7EB]/55 hover:text-red-400" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-[#1F2937] bg-[#0B0F19]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center bg-[#374151]">
              <ShieldCheck size={15} className="text-white" />
            </div>
            <span className="font-heading text-sm font-black">CaughtIn4K</span>
          </div>
          <div ref={searchRef} className="relative ml-auto w-full max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#E5E7EB]/55" />
            <input
              data-testid="global-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search employees, alerts, investigations..."
              className="w-full border border-[#1F2937] bg-[#0B0F19] py-2 pl-9 pr-3 text-sm text-[#E5E7EB] outline-none placeholder:text-[#E5E7EB]/40 focus:border-[#374151] focus:ring-1 focus:ring-[#374151]"
            />
            {results && (
              <div className="absolute left-0 right-0 top-full mt-2 max-h-96 overflow-y-auto border border-[#1F2937] bg-[#0B0F19] shadow-2xl">
                <SearchGroup title="Employees" items={results.employees} render={(e) => (
                  <Link key={e.employee_id} to={`/employees/${e.employee_id}`} onClick={() => { setQ(""); setResults(null); }}
                    className="flex items-center justify-between px-3 py-2 hover:bg-[#111827]/25">
                    <span className="text-sm">{e.name} <span className="font-mono text-xs text-[#E5E7EB]/55">{e.employee_id}</span></span>
                    <RiskBadge level={e.risk_level} />
                  </Link>
                )} />
                <SearchGroup title="Alerts" items={results.alerts} render={(a) => (
                  <Link key={a.alert_id} to="/alerts" onClick={() => { setQ(""); setResults(null); }}
                    className="flex items-center justify-between px-3 py-2 hover:bg-[#111827]/25">
                    <span className="text-sm">{a.description}</span>
                    <span className="font-mono text-xs text-[#E5E7EB]/55">{a.alert_id}</span>
                  </Link>
                )} />
                <SearchGroup title="Investigations" items={results.investigations} render={(i) => (
                  <Link key={i.investigation_id} to="/investigations" onClick={() => { setQ(""); setResults(null); }}
                    className="flex items-center justify-between px-3 py-2 hover:bg-[#111827]/25">
                    <span className="text-sm">{i.employee_name}</span>
                    <span className="font-mono text-xs text-[#E5E7EB]/55">{i.investigation_id}</span>
                  </Link>
                )} />
                {results.employees.length === 0 && results.alerts.length === 0 && results.investigations.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-[#E5E7EB]/55">No results</p>
                )}
              </div>
            )}
          </div>
          <Link data-testid="topbar-notifications" to="/notifications" className="relative shrink-0 border border-[#1F2937] bg-[#0B0F19] p-2 text-[#E5E7EB]/70 hover:text-[#E5E7EB]">
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#1F2937] bg-[#0B0F19] px-2 py-2 lg:hidden">
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cn("flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs", isActive ? "bg-[#374151]/15 text-[#374151]" : "text-[#E5E7EB]/70")}>
              <n.icon size={14} /> {n.label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 grid-noise p-4 lg:p-6">
          {liveAlerts.length > 0 && (
            <div data-testid="critical-alert-banner" className="alert-pulse mb-4 flex items-start gap-3 border border-red-500/40 border-l-4 border-l-red-500 bg-red-500/10 p-4">
              <Siren size={20} className="mt-0.5 shrink-0 animate-pulse text-red-400" />
              <div className="flex-1">
                <p className="font-heading text-sm font-bold text-red-300">Live Critical Alert{liveAlerts.length > 1 ? "s" : ""} — {liveAlerts.length} new</p>
                <p className="mt-0.5 text-sm text-red-200/90">{liveAlerts[0].message}</p>
                <Link to="/alerts" onClick={() => setLiveAlerts([])} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-300 underline-offset-2 hover:underline">
                  Investigate now <ChevronRight size={13} />
                </Link>
              </div>
              <button data-testid="clear-all-alerts-btn" onClick={() => { setLiveAlerts([]); toast.dismiss(); }}
                className="flex shrink-0 items-center gap-1.5 border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20">
                <CheckCheck size={14} /> Clear All
              </button>
              <button data-testid="dismiss-alert-banner" onClick={() => setLiveAlerts([])} className="shrink-0 text-red-400/70 hover:text-red-300"><X size={18} /></button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ n, badge }) {
  return (
    <NavLink
      to={n.to}
      data-testid={`nav-${n.label.toLowerCase().replace(/ /g, "-")}`}
      className={({ isActive }) =>
        cn(
          "group mb-0.5 flex items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors",
          isActive ? "bg-[#374151]/15 text-[#374151]" : "text-[#E5E7EB]/70 hover:bg-[#111827]/25/60 hover:text-[#E5E7EB]"
        )
      }
    >
      <n.icon size={16} />
      <span className="flex-1">{n.label}</span>
      {badge > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-bold text-white">{badge}</span>
      )}
    </NavLink>
  );
}

function SearchGroup({ title, items, render }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="border-b border-[#1F2937] bg-[#0B0F19] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#E5E7EB]/55">{title}</p>
      {items.map(render)}
    </div>
  );
}
