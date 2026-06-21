"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkAsset, ArkProjectIntegration, ArkIntegration } from "@/types/ark";

interface Props { projectId: string; }

const TYPE_SUGGESTIONS = ["working file", "final", "repurposable", "source", "reference", "template", "export"];
const CATEGORY_SUGGESTIONS = ["marketing", "social", "print", "web", "photo", "design", "document", "audio", "video"];

export default function AssetsIntegrationsSection({ projectId }: Props) {
  const [assets, setAssets] = useState<ArkAsset[]>([]);
  const [projectIntegrations, setProjectIntegrations] = useState<ArkProjectIntegration[]>([]);
  const [allIntegrations, setAllIntegrations] = useState<ArkIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddIntegration, setShowAddIntegration] = useState(false);
  const [editAsset, setEditAsset] = useState<ArkAsset | null>(null);
  const [editIntLink, setEditIntLink] = useState<ArkProjectIntegration | null>(null);

  // Asset form
  const [aTitle, setATitle] = useState("");
  const [aUrl, setAUrl] = useState("");
  const [aType, setAType] = useState("");
  const [aCategory, setACategory] = useState("");
  const [aDescription, setADescription] = useState("");
  const [aIntegrationId, setAIntegrationId] = useState("");

  // Integration link form
  const [linkIntId, setLinkIntId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNotes, setLinkNotes] = useState("");

  // Inline create integration
  const [showNewInt, setShowNewInt] = useState(false);
  const [newIntName, setNewIntName] = useState("");
  const [newIntIcon, setNewIntIcon] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [aRes, piRes, aiRes] = await Promise.all([
        fetch(`/api/admin/ark/${projectId}/assets`).then((r) => r.json()),
        fetch(`/api/admin/ark/${projectId}/integrations`).then((r) => r.json()),
        fetch("/api/admin/ark/integrations").then((r) => r.json()),
      ]);
      if (aRes.success) setAssets(aRes.assets || []);
      if (piRes.success) setProjectIntegrations(piRes.integrations || []);
      if (aiRes.success) setAllIntegrations(aiRes.integrations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetAssetForm = () => { setATitle(""); setAUrl(""); setAType(""); setACategory(""); setADescription(""); setAIntegrationId(""); };

  const saveAsset = async (isEdit: boolean) => {
    if (!aTitle.trim()) return;
    const body = { title: aTitle.trim(), url: aUrl || undefined, asset_type: aType || undefined, category: aCategory || undefined, description: aDescription || undefined, integration_id: aIntegrationId || undefined };
    if (isEdit && editAsset) {
      await fetch(`/api/admin/ark/${projectId}/assets/${editAsset.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch(`/api/admin/ark/${projectId}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    resetAssetForm(); setShowAddAsset(false); setEditAsset(null); fetchData();
  };

  const deleteAsset = async (id: string) => {
    await fetch(`/api/admin/ark/${projectId}/assets/${id}`, { method: "DELETE" }); fetchData();
  };

  const openEditAsset = (a: ArkAsset) => {
    setEditAsset(a); setATitle(a.title); setAUrl(a.url || ""); setAType(a.asset_type || ""); setACategory(a.category || ""); setADescription(a.description || ""); setAIntegrationId(a.integration_id || "");
  };

  const linkIntegration = async () => {
    if (!linkIntId) return;
    await fetch(`/api/admin/ark/${projectId}/integrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integration_id: linkIntId, access_url: linkUrl || undefined, notes: linkNotes || undefined }) });
    setLinkIntId(""); setLinkUrl(""); setLinkNotes(""); setShowAddIntegration(false); fetchData();
  };

  const unlinkIntegration = async (id: string) => {
    await fetch(`/api/admin/ark/${projectId}/integrations?id=${id}`, { method: "DELETE" }); fetchData();
  };

  const createIntegrationInline = async () => {
    if (!newIntName.trim()) return;
    await fetch("/api/admin/ark/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newIntName.trim(), icon: newIntIcon || undefined }) });
    setNewIntName(""); setNewIntIcon(""); setShowNewInt(false); fetchData();
  };

  const linkedIds = new Set(projectIntegrations.map((pi) => pi.integration_id));
  const unlinkedIntegrations = allIntegrations.filter((i) => !linkedIds.has(i.id));

  // Group assets by category
  const assetsByCategory: Record<string, ArkAsset[]> = {};
  for (const a of assets) {
    const cat = a.category || "Uncategorized";
    if (!assetsByCategory[cat]) assetsByCategory[cat] = [];
    assetsByCategory[cat].push(a);
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* INTEGRATIONS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider">Linked Platforms</h3>
          <button onClick={() => setShowAddIntegration(!showAddIntegration)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df]">+ Link Platform</button>
        </div>

        {showAddIntegration && (
          <div className="ark-card bg-[#1a1816] border border-[#302927] mb-3 space-y-3">
            <select value={linkIntId} onChange={(e) => setLinkIntId(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]">
              <option value="">Select a platform...</option>
              {unlinkedIntegrations.map((i) => <option key={i.id} value={i.id}>{i.icon ? `${i.icon} ` : ""}{i.name}</option>)}
            </select>
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Project URL on this platform" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <input type="text" value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} placeholder="How is this platform used?" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <div className="flex gap-2 items-center">
              <button onClick={linkIntegration} disabled={!linkIntId} className="px-3 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm disabled:opacity-40">Link</button>
              <button onClick={() => setShowAddIntegration(false)} className="px-3 py-1.5 ark-text-sm text-[#726d6c]">Cancel</button>
              <span className="ark-text-xs text-[#726d6c]">|</span>
              <button onClick={() => setShowNewInt(!showNewInt)} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df]">Create new platform</button>
            </div>
            {showNewInt && (
              <div className="flex gap-2 pt-2 border-t border-[#302927]">
                <input type="text" value={newIntIcon} onChange={(e) => setNewIntIcon(e.target.value)} placeholder="Icon" className="w-16 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-sm text-center text-[#ede8df] focus:outline-none" />
                <input type="text" value={newIntName} onChange={(e) => setNewIntName(e.target.value)} placeholder="Platform name (e.g. Photoshop)" className="flex-1 bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none" />
                <button onClick={createIntegrationInline} disabled={!newIntName.trim()} className="px-3 py-1 bg-[#302927] text-[#ede8df] rounded ark-text-xs disabled:opacity-40">Create</button>
              </div>
            )}
          </div>
        )}

        {projectIntegrations.length === 0 ? (
          <p className="ark-text-sm text-[#726d6c] py-4">No platforms linked. {allIntegrations.length === 0 && <button onClick={() => { setShowAddIntegration(true); setShowNewInt(true); }} className="text-[#843c2d] hover:text-[#ede8df]">Create one →</button>}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 ark-grid">
            {projectIntegrations.map((pi) => (
              <div
                key={pi.id}
                className="ark-row flex items-center bg-[#1a1816] border border-[#302927] group cursor-pointer hover:border-[#843c2d]/30"
                onClick={() => { setEditIntLink(pi); setLinkUrl(pi.access_url || ""); setLinkNotes(pi.notes || ""); }}
              >
                {pi.integration_icon && <span className="ark-emoji-sm">{pi.integration_icon}</span>}
                <div className="min-w-0 flex-1">
                  <div className="ark-text-sm font-medium text-[#ede8df]">{pi.integration_name}</div>
                  {pi.notes && <div className="ark-text-xs text-[#726d6c] truncate">{pi.notes}</div>}
                </div>
                {pi.access_url && (
                  <a href={pi.access_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#843c2d] hover:text-[#ede8df]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  </a>
                )}
                <button onClick={(e) => { e.stopPropagation(); unlinkIntegration(pi.id); }} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ASSETS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider">Assets & Files</h3>
          <button onClick={() => { resetAssetForm(); setShowAddAsset(!showAddAsset); }} className="ark-text-xs text-[#843c2d] hover:text-[#ede8df]">+ Add Asset</button>
        </div>

        {/* Add/Edit asset form */}
        {(showAddAsset || editAsset) && (
          <div className="ark-card bg-[#1a1816] border border-[#302927] mb-3 space-y-3">
            <h4 className="ark-text-sm font-medium text-[#ede8df]">{editAsset ? "Edit Asset" : "New Asset"}</h4>
            <input type="text" value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="Title *" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <input type="url" value={aUrl} onChange={(e) => setAUrl(e.target.value)} placeholder="URL or file path" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <textarea value={aDescription} onChange={(e) => setADescription(e.target.value)} placeholder="Description — what is this, what's its status?" rows={2} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y" />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block ark-text-xs text-[#726d6c] mb-1">Type</label>
                <input type="text" value={aType} onChange={(e) => setAType(e.target.value)} placeholder="e.g. working file" list="ark-asset-types" className="w-full bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-xs text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
                <datalist id="ark-asset-types">{TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
              <div>
                <label className="block ark-text-xs text-[#726d6c] mb-1">Category</label>
                <input type="text" value={aCategory} onChange={(e) => setACategory(e.target.value)} placeholder="e.g. marketing" list="ark-asset-cats" className="w-full bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-xs text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
                <datalist id="ark-asset-cats">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="block ark-text-xs text-[#726d6c] mb-1">Platform</label>
                <select value={aIntegrationId} onChange={(e) => setAIntegrationId(e.target.value)} className="w-full bg-[#0d0c0a] border border-[#302927] rounded px-2 py-1.5 ark-text-xs text-[#ede8df] focus:outline-none">
                  <option value="">None</option>
                  {allIntegrations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => saveAsset(!!editAsset)} disabled={!aTitle.trim()} className="px-4 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm disabled:opacity-40">{editAsset ? "Save" : "Add"}</button>
              <button onClick={() => { resetAssetForm(); setShowAddAsset(false); setEditAsset(null); }} className="px-4 py-1.5 ark-text-sm text-[#726d6c]">Cancel</button>
            </div>
          </div>
        )}

        {/* Assets grouped by category */}
        {assets.length === 0 ? (
          <p className="ark-text-sm text-[#726d6c] py-4">No assets yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(assetsByCategory).map(([cat, catAssets]) => (
              <div key={cat}>
                <h4 className="ark-text-xs font-medium text-[#726d6c] uppercase tracking-wider mb-1.5">{cat}</h4>
                <div className="ark-list">
                  {catAssets.map((a) => (
                    <div
                      key={a.id}
                      className="ark-row flex items-center bg-[#1a1816] border border-[#302927] group hover:border-[#843c2d]/30 cursor-pointer"
                      onClick={() => openEditAsset(a)}
                    >
                      {a.integration_icon && <span className="ark-text-sm">{a.integration_icon}</span>}
                      <div className="min-w-0 flex-1">
                        <span className="ark-text-sm text-[#ede8df]">{a.title}</span>
                        <div className="flex items-center gap-2">
                          {a.asset_type && <span className="ark-badge bg-[#302927] text-[#ede8df]">{a.asset_type}</span>}
                          {a.description && <span className="ark-text-xs text-[#726d6c] truncate">{a.description}</span>}
                          {a.integration_name && <span className="ark-text-xs" style={{ color: a.integration_color || "#726d6c" }}>{a.integration_name}</span>}
                        </div>
                      </div>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#843c2d] hover:text-[#ede8df] flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                        </a>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteAsset(a.id); }} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit integration link modal */}
      {editIntLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditIntLink(null)}>
          <div className="bg-[#1a1816] border border-[#302927] rounded-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="ark-text-lg font-medium text-[#ede8df]">Edit {editIntLink.integration_name} Link</h3>
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Access URL" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <textarea value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} placeholder="Notes" rows={2} className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 ark-text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d] resize-y" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditIntLink(null)} className="px-4 py-2 ark-text-sm text-[#726d6c]">Cancel</button>
              <button
                onClick={async () => {
                  // Update via DELETE + re-POST (simple approach since junction table has no direct update)
                  await fetch(`/api/admin/ark/${projectId}/integrations?id=${editIntLink.id}`, { method: "DELETE" });
                  await fetch(`/api/admin/ark/${projectId}/integrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integration_id: editIntLink.integration_id, access_url: linkUrl || undefined, notes: linkNotes || undefined }) });
                  setEditIntLink(null); fetchData();
                }}
                className="px-5 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg ark-text-sm font-medium hover:bg-[#843c2d]/80"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
