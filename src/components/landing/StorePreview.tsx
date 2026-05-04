'use client';

import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import { useStore } from '@/contexts/StoreContext';

interface StorePreviewProps {
  products: any[];
}

export default function StorePreview({ products }: StorePreviewProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10%' });
  const { openStore } = useStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const featuredProduct = products[0];
  const quickPicks = products.slice(1, 4);

  if (!products.length) return null;

  return (
    <section ref={ref} id="store" className="relative py-24 px-8 bg-[#0d0c0a]">
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
              Shop
            </p>
            <h2 className="text-4xl xl:text-5xl font-bold text-[#ede8df]">
              The Collection
            </h2>
          </div>
          <button
            onClick={openStore}
            className="text-[#ede8df]/60 hover:text-[#ede8df] text-sm font-medium transition-colors flex items-center gap-2"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </motion.div>

        {/* Featured + Quick Picks */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Featured Product */}
          {featuredProduct && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-7"
            >
              <button
                onClick={openStore}
                onMouseEnter={() => setHoveredId(featuredProduct.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="group relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#1a1816]"
              >
                {featuredProduct.image && (
                  <Image
                    src={featuredProduct.image}
                    alt={featuredProduct.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="50vw"
                  />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <p className="text-[#843c2d] text-xs font-medium uppercase tracking-wider mb-2">
                    Featured
                  </p>
                  <h3 className="text-[#ede8df] text-2xl font-semibold mb-2">
                    {featuredProduct.title}
                  </h3>
                  {featuredProduct.price && (
                    <p className="text-[#ede8df]/80 text-lg">
                      {featuredProduct.price} {featuredProduct.currencyCode}
                    </p>
                  )}
                </div>

                {/* Hover Action */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredId === featuredProduct.id ? 1 : 0 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="glass-surface px-8 py-4 rounded-full">
                    <span className="text-[#ede8df] font-medium">View in Store</span>
                  </div>
                </motion.div>
              </button>
            </motion.div>
          )}

          {/* Quick Picks */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-6">
            {quickPicks.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
              >
                <button
                  onClick={openStore}
                  onMouseEnter={() => setHoveredId(product.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="group relative w-full aspect-square rounded-2xl overflow-hidden bg-[#1a1816]"
                >
                  {product.image && (
                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="25vw"
                    />
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-[#ede8df] text-sm font-medium line-clamp-2 mb-1">
                      {product.title}
                    </h3>
                    {product.price && (
                      <p className="text-[#ede8df]/60 text-xs">
                        {product.price} {product.currencyCode}
                      </p>
                    )}
                  </div>

                  {/* Hover Action */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: hoveredId === product.id ? 1 : 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="glass-surface px-4 py-2 rounded-full">
                      <span className="text-[#ede8df] text-xs font-medium">Quick View</span>
                    </div>
                  </motion.div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
