'use client';

import { useState, useEffect } from 'react';
import ExportModal, { ExportOptions } from '../components/ExportModal';

interface Product {
  id: string;
  title: string;
  handle: string;
  price: number;
  status: string;
  images: string[];
  variants: any[];
  inventory?: number | string;
  category?: string;
  vendor?: string;
}

export default function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json() as { success: boolean; products: Product[] };
      console.log('ProductsTab received:', data);
      if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      } else {
        console.error('Invalid products data:', data);
      }
    } catch (e) {
      console.error('Failed to fetch products', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (options: ExportOptions) => {
    console.log('Exporting with options:', options);
    // Implement actual export logic here (e.g., generate CSV and download)
    alert(`Export started: ${options.scope} as ${options.format}`);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const filteredProducts = products.filter(product => {
    if (activeFilter === 'all') return true;
    return product.status === activeFilter;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#ede8df]">Products</h2>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 text-sm text-[#ede8df] bg-[#302927] hover:bg-[#403633] rounded-lg transition-colors"
          >
            Export
          </button>
          <button className="px-3 py-1.5 text-sm text-[#ede8df] bg-[#302927] hover:bg-[#403633] rounded-lg transition-colors">
            Import
          </button>
          <button className="px-3 py-1.5 text-sm text-[#ede8df] bg-[#302927] hover:bg-[#403633] rounded-lg transition-colors">
            More actions ▼
          </button>
          <a
            href="https://admin.shopify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm font-medium bg-[#ede8df] text-[#171616] rounded-lg hover:bg-white transition-colors flex items-center gap-2"
          >
            Manage in Shopify ↗
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Average sell-through rate</div>
          <div className="text-xl font-bold text-[#ede8df]">0% <span className="text-[#b2a491] text-sm font-normal">—</span></div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">Products by days of inventory remaining</div>
          <div className="text-sm text-[#b2a491]">No data</div>
        </div>
        <div className="bg-[#1c1a19] p-4 rounded-xl border border-[#502d26]/30">
          <div className="text-sm text-[#b2a491] mb-1">ABC product analysis</div>
          <div className="text-xl font-bold text-[#ede8df]">CA$0.00 <span className="text-[#b2a491] text-sm font-normal">C</span></div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-[#1c1a19] rounded-xl border border-[#502d26]/30 overflow-hidden">
        {/* Filter Bar */}
        <div className="border-b border-[#502d26]/30 p-2 flex items-center justify-between bg-[#302927]/20">
          <div className="flex gap-1">
            {['all', 'active', 'draft', 'archived'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                  activeFilter === filter
                    ? 'bg-[#302927] text-[#ede8df] font-medium'
                    : 'text-[#b2a491] hover:bg-[#302927]/50 hover:text-[#ede8df]'
                }`}
              >
                {filter}
              </button>
            ))}
            <button className="px-3 py-1.5 text-sm text-[#b2a491] hover:text-[#ede8df]">+</button>
          </div>
          <div className="flex gap-2">
            <button className="p-1.5 text-[#b2a491] hover:text-[#ede8df]">🔍</button>
            <button className="p-1.5 text-[#b2a491] hover:text-[#ede8df]">≡</button>
            <button className="p-1.5 text-[#b2a491] hover:text-[#ede8df]">⇅</button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#302927]/40 text-[#b2a491] border-b border-[#502d26]/30">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-[#502d26]/50 bg-[#171616] checked:bg-[#843c2d]"
                  />
                </th>
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Inventory</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium text-right">Channels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#502d26]/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#b2a491]">Loading products...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#b2a491]">No products found</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-[#302927]/20 transition-colors group">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded border-[#502d26]/50 bg-[#171616] checked:bg-[#843c2d]"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#302927] rounded-lg overflow-hidden flex-shrink-0 border border-[#502d26]/30">
                          {product.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#b2a491] text-xs">IMG</div>
                          )}
                        </div>
                        <span className="font-medium text-[#ede8df]">{product.title}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium capitalize ${
                        product.status === 'active' 
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="p-4 text-[#b2a491]">
                      {product.inventory ?? 'Inventory not tracked'}
                    </td>
                    <td className="p-4 text-[#b2a491]">
                      {product.category ?? 'Uncategorized'}
                    </td>
                    <td className="p-4 text-right text-[#b2a491]">
                      3
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer / Pagination */}
        <div className="p-4 border-t border-[#502d26]/30 text-center text-sm text-[#b2a491]">
          Learn more about products
        </div>
      </div>

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        totalProducts={products.length}
        selectedCount={selectedProducts.size}
        searchMatchCount={filteredProducts.length}
      />
    </div>
  );
}

