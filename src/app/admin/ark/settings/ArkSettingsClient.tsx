"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { ArkIntegration, ArkCategory, ArkStatus } from "@/types/ark";
import { ArkDensityProvider, DensityToggle } from "../ArkDensityContext";

type Tab = "integrations" | "categories" | "statuses";

export default function ArkSettingsClient() {
  return (
    <ArkDensityProvider>
      <SettingsInner />
    </ArkDensityProvider>
  );
}

function SettingsInner() {
  const [tab, setTab] = useState<Tab>("integrations");
  const [integrations, setIntegrations] = useState<ArkIntegration[]>([]);
  const [categories, setCategories] = useState<ArkCategory[]>([]);
  const [statuses, setStatuses] = useState<ArkStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [iRes, cRes, sRes] = await Promise.all([
      fetch("/api/admin/ark/integrations").then((r) => r.json()),
      fetch("/api/admin/ark/categories").then((r) => r.json()),
      fetch("/api/admin/ark/statuses").then((r) => r.json()),
    ]);
    if (iRes.success) setIntegrations(iRes.integrations || []);
    if (cRes.success) setCategories(cRes.categories || []);
    if (sRes.success) setStatuses(sRes.statuses || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "integrations", label: "Platforms" },
    { id: "categories", label: "Categories" },
    { id: "statuses", label: "Statuses" },
  ];

  if (loading) return <div className="min-h-screen bg-[#0d0c0a] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-[#ede8df]">
      <div className="border-b border-[#302927] px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/ark" className="text-[#726d6c] hover:text-[#ede8df]"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></Link>
            <h1 className="text-xl font-semibold">Ark Settings</h1>
          </div>
          <DensityToggle />
        </div>
      </div>

      <div className="border-b border-[#302927] px-4 sm:px-6">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 ark-text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-[#843c2d] text-[#ede8df]" : "border-transparent text-[#726d6c] hover:text-[#ede8df]"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="ark-section max-w-3xl">
        {tab === "integrations" && <IntegrationsTab items={integrations} onRefresh={fetchAll} />}
        {tab === "categories" && <CategoriesTab items={categories} onRefresh={fetchAll} />}
        {tab === "statuses" && <StatusesTab items={statuses} onRefresh={fetchAll} />}
      </div>
    </div>
  );
}

// ============ INTEGRATIONS TAB ============
function IntegrationsTab({ items, onRefresh }: { items: ArkIntegration[]; onRefresh: () => void }) {
  const [name, setName] = useState(""); const [icon, setIcon] = useState(""); const [pType, setPType] = useState(""); const [baseUrl, setBaseUrl] = useState(""); const [color, setColor] = useState(""); const [desc, setDesc] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return;
    const body = { name: name.trim(), icon: icon || undefined, platform_type: pType || undefined, base_url: baseUrl || undefined, color: color || undefined, description: desc || undefined };
    if (editId) {
      await fetch(`/api/admin/ark/integrations/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/admin/ark/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setName(""); setIcon(""); setPType(""); setBaseUrl(""); setColor(""); setDesc(""); setEditId(null); onRefresh();
  };

  const startEdit = (i: ArkIntegration) => { setEditId(i.id); setName(i.name); setIcon(i.icon || ""); setPType(i.platform_type || ""); setBaseUrl(i.base_url || ""); setColor(i.color || ""); setDesc(i.description || ""); };
  const del = async (id: string) => { await fetch(`/api/admin/ark/integrations/${id}`, { method: "DELETE" }); onRefresh(); };

  return (
    <div className="space-y-4">
      <div className="ark-card bg-[#1a1816] border border-[#302927] space-y-3">
        <h4 className="ark-text-sm font-medium text-[#ede8df]">{editId ? "Edit Platform" : "Add Platform"}</h4>
        <div className="grid grid-cols-4 gap-2">
          <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon" className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-center text-[#ede8df] focus:outline-none" />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className="col-span-2 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none" />
          <input type="text" value={pType} onChange={(e) => setPType(e.target.value)} placeholder="Type" className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL (optional)" className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none" />
          <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Color hex (optional)" className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim()} className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm disabled:opacity-40">{editId ? "Save" : "Add"}</button>
          {editId && <button onClick={() => { setEditId(null); setName(""); setIcon(""); }} className="px-4 py-1.5 ark-text-sm text-[#726d6c]">Cancel</button>}
        </div>
      </div>

      <div className="ark-list">
        {items.map((i) => (
          <div key={i.id} className="ark-row flex items-center bg-[#1a1816] border border-[#302927] group">
            {i.icon && <span className="ark-emoji-sm">{i.icon}</span>}
            <div className="flex-1 min-w-0">
              <span className="ark-text-sm font-medium text-[#ede8df]">{i.name}</span>
              {i.platform_type && <span className="ark-text-xs text-[#726d6c] ml-2">{i.platform_type}</span>}
            </div>
            <button onClick={() => startEdit(i)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df] opacity-0 group-hover:opacity-100">Edit</button>
            <button onClick={() => del(i.id)} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ CATEGORIES TAB ============
function CategoriesTab({ items, onRefresh }: { items: ArkCategory[]; onRefresh: () => void }) {
  const [name, setName] = useState(""); const [icon, setIcon] = useState(""); const [color, setColor] = useState(""); const [editId, setEditId] = useState<string | null>(null);
  const COLORS = ["#843c2d", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#6b7280"];

  const save = async () => {
    if (!name.trim()) return;
    const body = { name: name.trim(), icon: icon || undefined, color: color || undefined };
    if (editId) { await fetch(`/api/admin/ark/categories/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
    else { await fetch("/api/admin/ark/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
    setName(""); setIcon(""); setColor(""); setEditId(null); onRefresh();
  };
  const startEdit = (c: ArkCategory) => { setEditId(c.id); setName(c.name); setIcon(c.icon || ""); setColor(c.color || ""); };
  const del = async (id: string) => { await fetch(`/api/admin/ark/categories/${id}`, { method: "DELETE" }); onRefresh(); };

  return (
    <div className="space-y-4">
      <div className="ark-card bg-[#1a1816] border border-[#302927] space-y-3">
        <h4 className="ark-text-sm font-medium text-[#ede8df]">{editId ? "Edit Category" : "Add Category"}</h4>
        <div className="flex gap-2">
          <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon" className="w-16 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-center text-[#ede8df] focus:outline-none" />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name *" className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none" />
        </div>
        <div className="flex gap-1.5">
          {COLORS.map((c) => <button key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />)}
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim()} className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm disabled:opacity-40">{editId ? "Save" : "Add"}</button>
          {editId && <button onClick={() => { setEditId(null); setName(""); }} className="px-4 py-1.5 ark-text-sm text-[#726d6c]">Cancel</button>}
        </div>
      </div>
      <div className="ark-list">
        {items.map((c) => (
          <div key={c.id} className="ark-row flex items-center bg-[#1a1816] border border-[#302927] group">
            {c.icon && <span className="ark-emoji-sm">{c.icon}</span>}
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || "#6b7280" }} />
            <span className="ark-text-sm font-medium text-[#ede8df] flex-1">{c.name}</span>
            <button onClick={() => startEdit(c)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df] opacity-0 group-hover:opacity-100">Edit</button>
            <button onClick={() => del(c.id)} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ STATUSES TAB ============
function StatusesTab({ items, onRefresh }: { items: ArkStatus[]; onRefresh: () => void }) {
  const [name, setName] = useState(""); const [color, setColor] = useState("#6b7280"); const [appliesTo, setAppliesTo] = useState("all"); const [isClosed, setIsClosed] = useState(false); const [editId, setEditId] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return;
    const body = { name: name.trim(), color, applies_to: appliesTo, is_closed: isClosed };
    if (editId) { await fetch(`/api/admin/ark/statuses/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
    else { await fetch("/api/admin/ark/statuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
    setName(""); setColor("#6b7280"); setAppliesTo("all"); setIsClosed(false); setEditId(null); onRefresh();
  };
  const startEdit = (s: ArkStatus) => { setEditId(s.id); setName(s.name); setColor(s.color || "#6b7280"); setAppliesTo(s.applies_to); setIsClosed(s.is_closed === 1); };
  const del = async (id: string) => { await fetch(`/api/admin/ark/statuses/${id}`, { method: "DELETE" }); onRefresh(); };

  return (
    <div className="space-y-4">
      <div className="ark-card bg-[#1a1816] border border-[#302927] space-y-3">
        <h4 className="ark-text-sm font-medium text-[#ede8df]">{editId ? "Edit Status" : "Add Status"}</h4>
        <div className="flex gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-9 rounded border border-[#302927] bg-transparent cursor-pointer" />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Status name *" className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none" />
          <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-xs text-[#ede8df] focus:outline-none">
            <option value="all">All</option>
            <option value="project">Projects only</option>
            <option value="task">Tasks only</option>
          </select>
        </div>
        <label className="flex items-center gap-2 ark-text-sm text-[#726d6c] cursor-pointer">
          <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} className="rounded" />
          Closed/terminal state (marks items as done)
        </label>
        <div className="flex gap-2">
          <button onClick={save} disabled={!name.trim()} className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm disabled:opacity-40">{editId ? "Save" : "Add"}</button>
          {editId && <button onClick={() => { setEditId(null); setName(""); }} className="px-4 py-1.5 ark-text-sm text-[#726d6c]">Cancel</button>}
        </div>
      </div>
      <div className="ark-list">
        {items.map((s) => (
          <div key={s.id} className="ark-row flex items-center bg-[#1a1816] border border-[#302927] group">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || "#6b7280" }} />
            <span className="ark-text-sm font-medium text-[#ede8df] flex-1">{s.name}</span>
            <span className="ark-text-xs text-[#726d6c]">{s.applies_to}</span>
            {s.is_closed === 1 && <span className="ark-badge bg-[#302927] text-[#726d6c]">closed</span>}
            {s.is_default === 1 && <span className="ark-badge bg-[#843c2d]/20 text-[#843c2d]">default</span>}
            <button onClick={() => startEdit(s)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df] opacity-0 group-hover:opacity-100">Edit</button>
            <button onClick={() => del(s.id)} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        ))}
      </div>
    </div>
  );
}
