'use client';

import { useState, useEffect } from 'react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsed?: string;
  requestCount: number;
}

export default function ApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const availableScopes = [
    { id: 'read:products', label: 'Read Products', description: 'View product information' },
    { id: 'write:products', label: 'Write Products', description: 'Create and update products' },
    { id: 'read:orders', label: 'Read Orders', description: 'View order information' },
    { id: 'write:orders', label: 'Write Orders', description: 'Create and update orders' },
    { id: 'read:customers', label: 'Read Customers', description: 'View customer information' },
    { id: 'write:customers', label: 'Write Customers', description: 'Create and update customers' },
    { id: 'read:content', label: 'Read Content', description: 'View music, videos, and galleries' },
    { id: 'write:content', label: 'Write Content', description: 'Upload and manage content' },
    { id: 'admin', label: 'Admin Access', description: 'Full administrative access' },
  ];

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/admin/api-keys');
      if (res.ok) {
        const data = await res.json() as { keys?: ApiKey[] };
        setApiKeys(data.keys || []);
      }
    } catch (e) {
      console.error('Failed to fetch API keys', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || selectedScopes.size === 0) {
      alert('Please enter a name and select at least one scope');
      return;
    }

    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          scopes: Array.from(selectedScopes),
        }),
      });

      if (res.ok) {
        const data = await res.json() as { key: ApiKey };
        setApiKeys([...apiKeys, data.key]);
        setShowNewKeyModal(false);
        setNewKeyName('');
        setSelectedScopes(new Set());
        // Auto-reveal the newly created key
        setRevealedKeys(new Set([data.key.id]));
      }
    } catch (e) {
      console.error('Failed to create API key', e);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setApiKeys(apiKeys.map(k => k.id === keyId ? { ...k, status: 'revoked' } : k));
      }
    } catch (e) {
      console.error('Failed to revoke API key', e);
    }
  };

  const toggleRevealKey = (keyId: string) => {
    const newRevealed = new Set(revealedKeys);
    if (newRevealed.has(keyId)) {
      newRevealed.delete(keyId);
    } else {
      newRevealed.add(keyId);
    }
    setRevealedKeys(newRevealed);
  };

  const toggleScope = (scopeId: string) => {
    const newScopes = new Set(selectedScopes);
    if (newScopes.has(scopeId)) {
      newScopes.delete(scopeId);
    } else {
      newScopes.add(scopeId);
    }
    setSelectedScopes(newScopes);
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-[#b2a491]">Loading API keys...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#ede8df]">API Keys</h2>
          <p className="text-sm text-[#b2a491] mt-1">Manage API keys for programmatic access to your store</p>
        </div>
        <button
          onClick={() => setShowNewKeyModal(true)}
          className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
        >
          + Generate API Key
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Keys', value: apiKeys.length, color: '#3b82f6' },
          { label: 'Active', value: apiKeys.filter(k => k.status === 'active').length, color: '#10b981' },
          { label: 'Total Requests', value: apiKeys.reduce((sum, k) => sum + k.requestCount, 0).toLocaleString(), color: '#8b5cf6' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#302927] rounded-xl p-4">
            <div className="text-sm text-[#b2a491]">{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="bg-[#302927] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">🔑</div>
          <h3 className="text-lg font-semibold text-[#ede8df] mb-2">No API keys yet</h3>
          <p className="text-[#b2a491] mb-4">Generate your first API key to enable programmatic access</p>
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
          >
            + Generate API Key
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map(apiKey => (
            <div key={apiKey.id} className="bg-[#302927] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-[#ede8df]">{apiKey.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                      apiKey.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {apiKey.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <code className="text-sm font-mono text-[#b2a491] bg-[#403633] px-3 py-1.5 rounded">
                      {revealedKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                    </code>
                    <button
                      onClick={() => toggleRevealKey(apiKey.id)}
                      className="px-2 py-1 text-xs text-[#ede8df] bg-[#403633] hover:bg-[#504440] rounded transition-colors"
                    >
                      {revealedKeys.has(apiKey.id) ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(apiKey.key)}
                      className="px-2 py-1 text-xs text-[#ede8df] bg-[#403633] hover:bg-[#504440] rounded transition-colors"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {apiKey.scopes.map(scope => (
                      <span key={scope} className="px-2 py-1 text-xs bg-[#403633] text-[#ede8df] rounded">
                        {scope}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-6 text-sm text-[#b2a491]">
                    <div>
                      <span className="font-medium">Created:</span> {new Date(apiKey.createdAt).toLocaleDateString()}
                    </div>
                    {apiKey.lastUsed && (
                      <div>
                        <span className="font-medium">Last used:</span> {new Date(apiKey.lastUsed).toLocaleDateString()}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Requests:</span> {apiKey.requestCount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {apiKey.status === 'active' && (
                  <button
                    onClick={() => handleRevokeKey(apiKey.id)}
                    className="px-3 py-1.5 text-sm text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New API Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewKeyModal(false)}>
          <div className="bg-[#302927] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[#ede8df] mb-4">Generate New API Key</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API, Mobile App, etc."
                  className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#ede8df] mb-2">Permissions</label>
                <div className="space-y-2">
                  {availableScopes.map(scope => (
                    <label key={scope.id} className="flex items-start gap-3 p-3 bg-[#403633] rounded-lg cursor-pointer hover:bg-[#504440] transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedScopes.has(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="mt-1 w-4 h-4 rounded border-[#502d26] text-[#843c2d] focus:ring-[#843c2d]"
                      />
                      <div className="flex-1">
                        <div className="text-[#ede8df] font-medium">{scope.label}</div>
                        <div className="text-sm text-[#b2a491]">{scope.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewKeyModal(false);
                  setNewKeyName('');
                  setSelectedScopes(new Set());
                }}
                className="flex-1 px-4 py-2 text-sm bg-[#403633] text-[#ede8df] rounded-lg hover:bg-[#504440] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                className="flex-1 px-4 py-2 text-sm bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] transition-colors"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
