import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, ChevronRight } from "lucide-react";
import api from "../lib/api";
import { PageHeader, Loading, RiskBadge, StatusPill } from "../components/common";

const LEVELS = ["Critical", "High", "Medium", "Low"];

export default function EmployeeList() {
  const nav = useNavigate();
  const [emps, setEmps] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [level, setLevel] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (dept) params.set("department", dept);
    if (level) params.set("risk_level", level);
    const { data } = await api.get(`/employees?${params.toString()}`);
    setEmps(data);
  };
  useEffect(() => {
  const loadDepartments = async () => {
    try {
      const { data } = await api.get("/employees");

      const uniqueDepartments = [
        ...new Set(
          data
            .map((employee) => employee.department)
            .filter(Boolean)
        )
      ].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

      setDepartments(uniqueDepartments);
    } catch (error) {
      console.error("Failed to load departments", error);
    }
  };

  loadDepartments();
}, []);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, dept, level]);

  return (
    <div className="space-y-6">
      <PageHeader title="Employee Risk Registry" subtitle="AI-scored behavioural risk across the organisation" />

      {/* Filters */}
      <div className="flex flex-col gap-3 border border-[#1F2937] bg-[#111827]/10 p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E5E7EB]/55" />
          <input data-testid="employee-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name or department..."
            className="w-full border border-[#1F2937] bg-[#0B0F19] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#374151]" />
        </div>
        <select data-testid="filter-department" value={dept} onChange={(e) => setDept(e.target.value)}
          className="border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm text-[#E5E7EB]/90 outline-none focus:border-[#374151]">
          <option value="">All Departments</option>
          {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
        </select>
        <select data-testid="filter-risk-level" value={level} onChange={(e) => setLevel(e.target.value)}
          className="border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm text-[#E5E7EB]/90 outline-none focus:border-[#374151]">
          <option value="">All Risk Levels</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {!emps ? <Loading /> : (
        <div className="overflow-x-auto border border-[#1F2937]">
          <table className="w-full text-sm" data-testid="employee-table">
            <thead>
              <tr className="border-b border-[#1F2937] bg-[#0B0F19] text-left font-mono text-[10px] uppercase tracking-wider text-[#E5E7EB]/55">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3 text-right">Risk Score</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Investigation</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {emps.map((e) => (
                <tr key={e.employee_id} data-testid={`employee-row-${e.employee_id}`}
                  onClick={() => nav(`/employees/${e.employee_id}`)}
                  className="cursor-pointer border-b border-[#1F2937]/60 hover:bg-[#0B0F19]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={e.avatar} alt="" className="h-8 w-8 rounded-sm object-cover" />
                      <div>
                        <p className="font-medium text-[#E5E7EB]">{e.name}</p>
                        <p className="font-mono text-xs text-[#E5E7EB]/55">{e.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#E5E7EB]/70">{e.department}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-lg font-bold" style={{ color: e.risk_score >= 81 ? "#ef4444" : e.risk_score >= 61 ? "#f59e0b" : e.risk_score >= 31 ? "#eab308" : "#22c55e" }}>
                      {e.risk_score}
                    </span>
                  </td>
                  <td className="px-4 py-3"><RiskBadge level={e.risk_level} /></td>
                  <td className="px-4 py-3"><StatusPill status={e.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-[#E5E7EB]/55">{String(e.last_login || "-").slice(0, 16).replace("T", " ")}</td>
                  <td className="px-4 py-3">
                    {e.current_investigation ? <span className="font-mono text-xs text-amber-400">{e.current_investigation}</span> : <span className="text-xs text-[#E5E7EB]/40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#E5E7EB]/40"><ChevronRight size={16} /></td>
                </tr>
              ))}
              {emps.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#E5E7EB]/55">No employees match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
