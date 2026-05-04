'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import { useStore } from '@/contexts/StoreContext';

interface ProductsSectionProps {
  products: any[];
}

export default function ProductsSection({ products }: ProductsSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10%' });
  const { openStore } = useStore();

  if (!products.length) return null;

  return (
    <section ref={ref} id="products" className="relative py-24 px-8 bg-[#0d0c0a]">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-12 flex items-end justify-between"
        >
          <div>
            <p className="text-[#843c2d] text-sm font-medium uppercase tracking-[0.2em] mb-2">
              Full Collection
            </p>
            <h2 className="text-4xl xl:text-5xl font-bold text-[#ede8df]">
              All Products
            </h2>
          </div>
          <button
            onClick={openStore}
            className="text-[#ede8df]/60 hover:text-[#ede8df] text-sm font-medium transition-colors flex items-center gap-2"
          >
            Open Store
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <button
                onClick={openStore}
                className="group w-full text-left"
              >
                {/* Product Image */}
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#1a1816] mb-4">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="25vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#843c2d]/10 to-[#1a1816]" />
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="glass-surface px-6 py-3 rounded-full">
                      <span className="text-[#ede8df] text-sm font-medium">View Details</span>
                    </div>
                  </div>

                  {/* Availability Badge */}
                  {!product.availableForSale && (
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                      <span className="text-white/60 text-xs">Sold Out</span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <h3 className="text-[#ede8df] font-medium text-sm line-clamp-2 mb-1 group-hover:text-[#ede8df]/90 transition-colors">
                  {product.title}
                </h3>
                {product.price && (
                  <p className="text-[#843c2d] text-sm font-medium">
                    {product.price} {product.currencyCode}
                  </p>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
