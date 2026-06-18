"use client";

import { useEffect, useState, useCallback } from "react";
import type { ArkAsset, ArkProjectIntegration, ArkIntegration } from "@/types/ark";

interface Props {
  projectId: string;
}

export default function AssetsIntegrationsSection({ projectId }: Props) {
  const [assets, setAssets] = useState<ArkAsset[]>([]);
  const [projectIntegrations, setProjectIntegrations] = useState<ArkProjectIntegration[]>([]);
  const [allIntegrations, setAllIntegrations] = useState<ArkIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddIntegration, setShowAddIntegration] = useState(false);

  // Asset form
  const [assetTitle, setAssetTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetType, setAssetType] = useState("");
  const [assetCategory, setAssetCategory] = useState("");
  const [assetIntegrationId, setAssetIntegrationId] = useState("");

  // Integration link form
  const [linkIntegrationId, setLinkIntegrationId] = useState("");
  const [linkAccessUrl, setLinkAccessUrl] = useState("");
  const [linkNotes, setLinkNotes] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [assetsRes, intRes, allIntRes] = await Promise.all([
        fetch(`/api/admin/ark/${projectId}/assets`).then((r) => r.json()),
        fetch(`/api/admin/ark/${projectId}/integrations`).then((r) => r.json()),
        fetch("/api/admin/ark/integrations").then((r) => r.json()),
      ]);
      if (assetsRes.success) setAssets(assetsRes.assets || []);
      if (intRes.success) setProjectIntegrations(intRes.integrations || []);
      if (allIntRes.success) setAllIntegrations(allIntRes.integrations || []);
    } catch (e) {
      console.error("Failed to fetch assets/integrations:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addAsset = async () => {
    if (!assetTitle.trim()) return;
    await fetch(`/api/admin/ark/${projectId}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: assetTitle.trim(),
        url: assetUrl || undefined,
        asset_type: assetType || undefined,
        category: assetCategory || undefined,
        integration_id: assetIntegrationId || undefined,
      }),
    });
    setAssetTitle(""); setAssetUrl(""); setAssetType(""); setAssetCategory(""); setAssetIntegrationId("");
    setShowAddAsset(false);
    fetchData();
  };

  const deleteAsset = async (id: string) => {
    await fetch(`/api/admin/ark/${projectId}/assets/${id}`, { method: "DELETE" });
    fetchData();
  };

  const linkIntegration = async () => {
    if (!linkIntegrationId) return;
    await fetch(`/api/admin/ark/${projectId}/integrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integration_id: linkIntegrationId,
        access_url: linkAccessUrl || undefined,
        notes: linkNotes || undefined,
      }),
    });
    setLinkIntegrationId(""); setLinkAccessUrl(""); setLinkNotes("");
    setShowAddIntegration(false);
    fetchData();
  };

  const unlinkIntegration = async (id: string) => {
    await fetch(`/api/admin/ark/${projectId}/integrations?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const linkedIds = new Set(projectIntegrations.map((pi) => pi.integration_id));
  const unlinkedIntegrations = allIntegrations.filter((i) => !linkedIds.has(i.id));

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Integrations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">Linked Platforms</h3>
          <button onClick={() => setShowAddIntegration(!showAddIntegration)} className="text-xs text-[#843c2d] hover:text-[#ede8df]">
            + Link Platform
          </button>
        </div>

        {showAddIntegration && (
          <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-4 mb-3 space-y-3">
            <select
              value={linkIntegrationId}
              onChange={(e) => setLinkIntegrationId(e.target.value)}
              className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
            >
              <option value="">Select a platform...</option>
              {unlinkedIntegrations.map((i) => (
                <option key={i.id} value={i.id}>{i.icon ? `${i.icon} ` : ""}{i.name}</option>
              ))}
            </select>
            <input type="url" value={linkAccessUrl} onChange={(e) => setLinkAccessUrl(e.target.value)} placeholder="Project URL on this platform (optional)" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <input type="text" value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} placeholder="How is this platform used? (optional)" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <div className="flex gap-2">
              <button onClick={linkIntegration} disabled={!linkIntegrationId} className="px-3 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm disabled:opacity-40">Link</button>
              <button onClick={() => setShowAddIntegration(false)} className="px-3 py-1.5 text-sm text-[#726d6c]">Cancel</button>
            </div>
          </div>
        )}

        {projectIntegrations.length === 0 ? (
          <p className="text-sm text-[#726d6c] py-4">No platforms linked yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {projectIntegrations.map((pi) => (
              <div key={pi.id} className="flex items-center gap-3 bg-[#1a1816] border border-[#302927] rounded-lg px-4 py-3 group">
                {pi.integration_icon && <span className="text-xl">{pi.integration_icon}</span>}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#ede8df]">{pi.integration_name}</div>
                  {pi.integration_platform_type && <div className="text-[10px] text-[#726d6c]">{pi.integration_platform_type}</div>}
                  {pi.notes && <div className="text-[10px] text-[#726d6c] mt-0.5 truncate">{pi.notes}</div>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {pi.access_url && (
                    <a href={pi.access_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#843c2d] hover:text-[#ede8df]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                    </a>
                  )}
                  <button onClick={() => unlinkIntegration(pi.id)} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#726d6c] uppercase tracking-wider">Assets & Links</h3>
          <button onClick={() => setShowAddAsset(!showAddAsset)} className="text-xs text-[#843c2d] hover:text-[#ede8df]">
            + Add Asset
          </button>
        </div>

        {showAddAsset && (
          <div className="bg-[#1a1816] border border-[#302927] rounded-lg p-4 mb-3 space-y-3">
            <input type="text" value={assetTitle} onChange={(e) => setAssetTitle(e.target.value)} placeholder="Title *" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <input type="url" value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} placeholder="URL" className="w-full bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={assetType} onChange={(e) => setAssetType(e.target.value)} placeholder="Type (file, link...)" className="bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
              <input type="text" value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)} placeholder="Category" className="bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] placeholder-[#726d6c] focus:outline-none focus:border-[#843c2d]" />
              <select value={assetIntegrationId} onChange={(e) => setAssetIntegrationId(e.target.value)} className="bg-[#0d0c0a] border border-[#302927] rounded-lg px-3 py-2 text-sm text-[#ede8df] focus:outline-none focus:border-[#843c2d]">
                <option value="">Platform</option>
                {allIntegrations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={addAsset} disabled={!assetTitle.trim()} className="px-3 py-1.5 bg-[#843c2d] text-[#ede8df] rounded-lg text-sm disabled:opacity-40">Add</button>
              <button onClick={() => setShowAddAsset(false)} className="px-3 py-1.5 text-sm text-[#726d6c]">Cancel</button>
            </div>
          </div>
        )}

        {assets.length === 0 ? (
          <p className="text-sm text-[#726d6c] py-4">No assets yet.</p>
        ) : (
          <div className="space-y-1">
            {assets.map((a) => (
              <div key={a.id} className="flex items-center gap-3 bg-[#1a1816] border border-[#302927] rounded-lg px-4 py-2.5 group hover:border-[#843c2d]/30 transition-colors">
                {a.integration_icon && <span className="text-sm">{a.integration_icon}</span>}
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-[#ede8df]">{a.title}</span>
                  <div className="flex items-center gap-2 text-[10px] text-[#726d6c]">
                    {a.asset_type && <span>{a.asset_type}</span>}
                    {a.category && <span>{a.category}</span>}
                    {a.integration_name && <span style={{ color: a.integration_color || undefined }}>{a.integration_name}</span>}
                  </div>
                </div>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[#843c2d] hover:text-[#ede8df] flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  </a>
                )}
                <button onClick={() => deleteAsset(a.id)} className="text-[#726d6c] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
