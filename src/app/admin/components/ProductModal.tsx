"use client";

import { useState } from 'react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: any) => void;
}

export default function ProductModal({ isOpen, onClose, onSave }: ProductModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [costPerItem, setCostPerItem] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('active');
  const [category, setCategory] = useState('');
  const [productType, setProductType] = useState('');
  const [vendor, setVendor] = useState('');
  const [collections, setCollections] = useState('');
  const [tags, setTags] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      price: parseFloat(price),
      compareAtPrice: parseFloat(compareAtPrice),
      costPerItem: parseFloat(costPerItem),
      sku,
      barcode,
      quantity: parseInt(quantity),
      status,
      category,
      productType,
      vendor,
      collections: collections.split(',').map(c => c.trim()),
      tags: tags.split(',').map(t => t.trim()),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#1c1a19] w-full max-w-5xl rounded-xl shadow-2xl border border-[#502d26]/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#502d26]/30">
          <h2 className="text-lg font-bold text-[#ede8df]">Add product</h2>
          <button onClick={onClose} className="text-[#b2a491] hover:text-[#ede8df]">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title & Description */}
              <div className="bg-[#302927]/40 p-4 rounded-lg border border-[#502d26]/30">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#ede8df] mb-1">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                      placeholder="Short sleeve t-shirt"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#ede8df] mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={6}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df] focus:outline-none focus:border-[#843c2d]"
                    />
                  </div>
                </div>
              </div>

              {/* Media */}
              <div className="bg-[#302927]/40 p-4 rounded-lg border border-[#502d26]/30">
                <h3 className="text-sm font-medium text-[#ede8df] mb-4">Media</h3>
                <div className="border-2 border-dashed border-[#502d26]/30 rounded-lg p-8 text-center hover:bg-[#302927]/60 transition-colors cursor-pointer">
                  <div className="text-[#b2a491]">
                    <span className="text-[#843c2d] font-medium">Upload new</span> or select existing
                  </div>
                  <p className="text-xs text-[#b2a491]/70 mt-1">Accepts images, videos, or 3D models</p>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-[#302927]/40 p-4 rounded-lg border border-[#502d26]/30">
                <h3 className="text-sm font-medium text-[#ede8df] mb-4">Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-[#b2a491]">$</span>
                      <input
                        type="number"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg pl-7 pr-3 py-2 text-[#ede8df]"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Compare-at price</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-[#b2a491]">$</span>
                      <input
                        type="number"
                        value={compareAtPrice}
                        onChange={e => setCompareAtPrice(e.target.value)}
                        className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg pl-7 pr-3 py-2 text-[#ede8df]"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#502d26]/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#b2a491] mb-1">Cost per item</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-[#b2a491]">$</span>
                        <input
                          type="number"
                          value={costPerItem}
                          onChange={e => setCostPerItem(e.target.value)}
                          className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg pl-7 pr-3 py-2 text-[#ede8df]"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div className="bg-[#302927]/40 p-4 rounded-lg border border-[#502d26]/30">
                <h3 className="text-sm font-medium text-[#ede8df] mb-4">Inventory</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">SKU (Stock Keeping Unit)</label>
                    <input
                      type="text"
                      value={sku}
                      onChange={e => setSku(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Barcode (ISBN, UPC, GTIN, etc.)</label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={e => setBarcode(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs text-[#b2a491] mb-1">Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df] max-w-[150px]"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              {/* Status */}
              <div className="bg-[#302927]/40 p-4 rounded-lg border border-[#502d26]/30">
                <h3 className="text-sm font-medium text-[#ede8df] mb-4">Status</h3>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Organization */}
              <div className="bg-[#302927]/40 p-4 rounded-lg border border-[#502d26]/30">
                <h3 className="text-sm font-medium text-[#ede8df] mb-4">Product organization</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Product category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Product type</label>
                    <input
                      type="text"
                      value={productType}
                      onChange={e => setProductType(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Vendor</label>
                    <input
                      type="text"
                      value={vendor}
                      onChange={e => setVendor(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Collections</label>
                    <input
                      type="text"
                      value={collections}
                      onChange={e => setCollections(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                      placeholder="Search collections..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#b2a491] mb-1">Tags</label>
                    <input
                      type="text"
                      value={tags}
                      onChange={e => setTags(e.target.value)}
                      className="w-full bg-[#171616] border border-[#502d26]/30 rounded-lg px-3 py-2 text-[#ede8df]"
                      placeholder="Vintage, Cotton, Summer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#502d26]/30 flex justify-end gap-3 bg-[#1c1a19] rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#ede8df] hover:bg-[#302927] rounded-lg transition-colors"
          >
            Discard
          </button>
          <button
            type="submit"
            form="product-form"
            className="px-4 py-2 bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#a0472f] transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
