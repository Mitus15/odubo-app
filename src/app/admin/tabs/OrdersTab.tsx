'use client';

import { useState, useEffect } from 'react';

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

  if (loading) return <div className="text-[#b2a491]">Loading orders...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#ede8df] mb-6">Orders</h2>
      <div className="glass-surface rounded-2xl border border-[#502d26]/30 overflow-hidden">
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
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
