"use client";

import { useState } from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  totalProducts: number;
  selectedCount: number;
  searchMatchCount: number;
}

export interface ExportOptions {
  scope: 'current_page' | 'all' | 'selected' | 'search_matches';
  format: 'csv_excel' | 'csv_plain';
}

export default function ExportModal({ 
  isOpen, 
  onClose, 
  onExport, 
  totalProducts, 
  selectedCount, 
  searchMatchCount 
}: ExportModalProps) {
  const [scope, setScope] = useState<'current_page' | 'all' | 'selected' | 'search_matches'>('current_page');
  const [format, setFormat] = useState<'csv_excel' | 'csv_plain'>('csv_excel');

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({ scope, format });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#1c1a19] w-full max-w-md rounded-xl shadow-2xl border border-[#502d26]/30 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#502d26]/30">
          <h2 className="text-lg font-bold text-[#ede8df]">Export products</h2>
          <button onClick={onClose} className="text-[#b2a491] hover:text-[#ede8df]">✕</button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-[#b2a491]">
            This CSV file can update all product information. To update just inventory quantities use the <a href="#" className="text-[#843c2d] hover:underline">CSV file for inventory</a>.
          </p>

          {/* Export Scope */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#ede8df]">Export</h3>
            
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scope === 'current_page' ? 'border-[#843c2d]' : 'border-[#502d26]/50 group-hover:border-[#b2a491]'}`}>
                {scope === 'current_page' && <div className="w-2.5 h-2.5 rounded-full bg-[#843c2d]" />}
              </div>
              <input 
                type="radio" 
                name="scope" 
                value="current_page" 
                checked={scope === 'current_page'} 
                onChange={() => setScope('current_page')} 
                className="hidden" 
              />
              <span className="text-sm text-[#ede8df]">Current page</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scope === 'all' ? 'border-[#843c2d]' : 'border-[#502d26]/50 group-hover:border-[#b2a491]'}`}>
                {scope === 'all' && <div className="w-2.5 h-2.5 rounded-full bg-[#843c2d]" />}
              </div>
              <input 
                type="radio" 
                name="scope" 
                value="all" 
                checked={scope === 'all'} 
                onChange={() => setScope('all')} 
                className="hidden" 
              />
              <span className="text-sm text-[#ede8df]">All products</span>
            </label>

            <label className={`flex items-center gap-3 ${selectedCount > 0 ? 'cursor-pointer group' : 'opacity-50 cursor-not-allowed'}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scope === 'selected' ? 'border-[#843c2d]' : 'border-[#502d26]/50 group-hover:border-[#b2a491]'}`}>
                {scope === 'selected' && <div className="w-2.5 h-2.5 rounded-full bg-[#843c2d]" />}
              </div>
              <input 
                type="radio" 
                name="scope" 
                value="selected" 
                checked={scope === 'selected'} 
                onChange={() => setScope('selected')} 
                disabled={selectedCount === 0}
                className="hidden" 
              />
              <span className="text-sm text-[#ede8df]">Selected: {selectedCount} products</span>
            </label>

            <label className={`flex items-center gap-3 ${searchMatchCount > 0 ? 'cursor-pointer group' : 'opacity-50 cursor-not-allowed'}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${scope === 'search_matches' ? 'border-[#843c2d]' : 'border-[#502d26]/50 group-hover:border-[#b2a491]'}`}>
                {scope === 'search_matches' && <div className="w-2.5 h-2.5 rounded-full bg-[#843c2d]" />}
              </div>
              <input 
                type="radio" 
                name="scope" 
                value="search_matches" 
                checked={scope === 'search_matches'} 
                onChange={() => setScope('search_matches')} 
                disabled={searchMatchCount === 0}
                className="hidden" 
              />
              <span className="text-sm text-[#ede8df]">{searchMatchCount} products matching your search</span>
            </label>
          </div>

          {/* Export Format */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#ede8df]">Export as</h3>
            
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${format === 'csv_excel' ? 'border-[#843c2d]' : 'border-[#502d26]/50 group-hover:border-[#b2a491]'}`}>
                {format === 'csv_excel' && <div className="w-2.5 h-2.5 rounded-full bg-[#843c2d]" />}
              </div>
              <input 
                type="radio" 
                name="format" 
                value="csv_excel" 
                checked={format === 'csv_excel'} 
                onChange={() => setFormat('csv_excel')} 
                className="hidden" 
              />
              <span className="text-sm text-[#ede8df]">CSV for Excel, Numbers, or other spreadsheet programs</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${format === 'csv_plain' ? 'border-[#843c2d]' : 'border-[#502d26]/50 group-hover:border-[#b2a491]'}`}>
                {format === 'csv_plain' && <div className="w-2.5 h-2.5 rounded-full bg-[#843c2d]" />}
              </div>
              <input 
                type="radio" 
                name="format" 
                value="csv_plain" 
                checked={format === 'csv_plain'} 
                onChange={() => setFormat('csv_plain')} 
                className="hidden" 
              />
              <span className="text-sm text-[#ede8df]">Plain CSV file</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#502d26]/30 flex justify-end gap-3 bg-[#1c1a19] rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#ede8df] hover:bg-[#302927] rounded-lg transition-colors border border-[#502d26]/50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#a0472f] transition-colors font-medium"
          >
            Export products
          </button>
        </div>
      </div>
    </div>
  );
}
