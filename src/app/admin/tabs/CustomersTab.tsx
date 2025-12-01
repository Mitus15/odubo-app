'use client';

import { useState, useEffect } from 'react';

export default function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then((data: any) => {
        if (data.success) setCustomers(data.customers);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-[#b2a491]">Loading customers...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#ede8df] mb-6">Customers</h2>
      <div className="glass-surface rounded-2xl border border-[#502d26]/30 overflow-hidden">
        <table className="w-full text-left text-sm text-[#b2a491]">
          <thead className="bg-[#302927]/40 text-[#ede8df] uppercase font-medium">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#502d26]/30">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-[#302927]/20 transition-colors">
                <td className="px-6 py-4 font-medium text-[#ede8df]">{customer.first_name} {customer.last_name}</td>
                <td className="px-6 py-4">{customer.email}</td>
                <td className="px-6 py-4">{new Date(customer.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center">No customers found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
