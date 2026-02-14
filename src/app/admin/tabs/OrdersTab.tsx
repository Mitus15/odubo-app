'use client';

import { useState, useEffect } from 'react';
import { MobileCard } from '@/components/admin/MobileCard';

interface OrdersResponse {
  success: boolean;
  orders: any[];
}

export default function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders')
      .then(res => res.json())
      .then((data) => {
        const typedData = data as OrdersResponse;
        if (typedData.success) setOrders(typedData.orders);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-3 sm:p-4 md:p-6 text-[#b2a491]">Loading orders...</div>;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-full md:max-w-[1600px] mx-auto">
      <h2 className="text-xl md:text-2xl font-bold text-[#ede8df] mb-4 sm:mb-6">Orders</h2>
      <div className="glass-surface rounded-2xl border border-[#502d26]/30 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-[#b2a491]">No orders found.</div>
        ) : (
          <>
            {/* Mobile: Card view */}
            <div className="md:hidden space-y-3 p-3">
              {orders.map((order) => (
                <MobileCard
                  key={order.id}
                  title={`Order #${order.order_number}`}
                  fields={[
                    {
                      label: 'Date',
                      value: new Date(order.created_at).toLocaleDateString(),
                    },
                    {
                      label: 'Customer',
                      value: order.customer_name,
                    },
                    {
                      label: 'Total',
                      value: `$${order.total_amount}`,
                    },
                    {
                      label: 'Status',
                      value: (
                        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                          {order.status}
                        </span>
                      ),
                    },
                  ]}
                />
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-[#b2a491]">
                <thead className="bg-[#302927]/40 text-[#ede8df] uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4">Order</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#502d26]/30">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-[#302927]/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-[#ede8df]">#{order.order_number}</td>
                      <td className="px-6 py-4">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{order.customer_name}</td>
                      <td className="px-6 py-4">${order.total_amount}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
