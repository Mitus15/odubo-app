'use client';

import { useState, useEffect } from 'react';

interface Customer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  totalSpent: number;
  ordersCount: number;
  paidOrdersCount: number;
  lastOrderDate: string | null;
  createdAt: string;
}

interface OrderItem {
  id: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  totalPrice: number;
  imageUrl: string | null;
}

interface Order {
  id: string;
  orderNumber: number;
  totalAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  items: OrderItem[];
}

interface CustomerDetail {
  customer: Customer;
  stats: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    firstOrderDate: string | null;
    lastOrderDate: string | null;
  };
  orders: Order[];
}

type SortField = 'created_at' | 'total_spent' | 'orders_count' | 'email' | 'first_name';

export default function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('total_spent');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [sortField, sortOrder]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/customers?sort=${sortField}&order=${sortOrder}`);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerDetail = async (customerId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/orders`);
      const data = await res.json();
      if (data.success) {
        setSelectedCustomer(data);
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      setSortOrder('DESC');
    }
  };

  const formatCurrency = (amount: number, currency = 'CAD') => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      fulfilled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
      refunded: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 text-[10px]">
      {sortField === field ? (sortOrder === 'ASC' ? '▲' : '▼') : ''}
    </span>
  );

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    return name.includes(query) || c.email.toLowerCase().includes(query);
  });

  // Calculate summary stats
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const averageLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const repeatCustomers = customers.filter((c) => c.ordersCount > 1).length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-[#b2a491]">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#ede8df]">Customers</h2>
        <div className="text-sm text-[#b2a491]">
          {totalCustomers} total customers
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-surface rounded-xl border border-[#502d26]/30 p-4">
          <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Total Customers</div>
          <div className="text-2xl font-bold text-[#ede8df]">{totalCustomers}</div>
        </div>
        <div className="glass-surface rounded-xl border border-[#502d26]/30 p-4">
          <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="glass-surface rounded-xl border border-[#502d26]/30 p-4">
          <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Average LTV</div>
          <div className="text-2xl font-bold text-[#ede8df]">{formatCurrency(averageLTV)}</div>
        </div>
        <div className="glass-surface rounded-xl border border-[#502d26]/30 p-4">
          <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Repeat Buyers</div>
          <div className="text-2xl font-bold text-[#ede8df]">
            {repeatCustomers}
            <span className="text-sm font-normal text-[#b2a491] ml-2">
              ({totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0}%)
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-[#201d1c] border border-[#502d26]/30 rounded-lg text-[#ede8df] placeholder-[#b2a491]/50 focus:outline-none focus:ring-2 focus:ring-[#502d26]/50"
        />
      </div>

      {/* Customer Table */}
      <div className="glass-surface rounded-2xl border border-[#502d26]/30 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#302927]/40 text-[#b2a491] uppercase text-xs font-medium">
            <tr>
              <th
                className="px-6 py-4 cursor-pointer hover:text-[#ede8df] transition-colors"
                onClick={() => handleSort('first_name')}
              >
                Customer<SortIcon field="first_name" />
              </th>
              <th
                className="px-6 py-4 cursor-pointer hover:text-[#ede8df] transition-colors"
                onClick={() => handleSort('email')}
              >
                Email<SortIcon field="email" />
              </th>
              <th
                className="px-6 py-4 cursor-pointer hover:text-[#ede8df] transition-colors text-right"
                onClick={() => handleSort('orders_count')}
              >
                Orders<SortIcon field="orders_count" />
              </th>
              <th
                className="px-6 py-4 cursor-pointer hover:text-[#ede8df] transition-colors text-right"
                onClick={() => handleSort('total_spent')}
              >
                Total Spent<SortIcon field="total_spent" />
              </th>
              <th className="px-6 py-4 text-right">Last Order</th>
              <th
                className="px-6 py-4 cursor-pointer hover:text-[#ede8df] transition-colors"
                onClick={() => handleSort('created_at')}
              >
                Joined<SortIcon field="created_at" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#502d26]/30">
            {filteredCustomers.map((customer) => (
              <tr
                key={customer.id}
                className="hover:bg-[#302927]/20 transition-colors cursor-pointer"
                onClick={() => fetchCustomerDetail(customer.id)}
              >
                <td className="px-6 py-4">
                  <div className="font-medium text-[#ede8df]">
                    {customer.firstName || customer.lastName
                      ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
                      : 'Guest'}
                  </div>
                </td>
                <td className="px-6 py-4 text-[#b2a491]">{customer.email}</td>
                <td className="px-6 py-4 text-right">
                  <span className={`${customer.ordersCount > 1 ? 'text-emerald-400' : 'text-[#b2a491]'}`}>
                    {customer.ordersCount}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-medium text-[#ede8df]">
                  {formatCurrency(customer.totalSpent)}
                </td>
                <td className="px-6 py-4 text-right text-[#b2a491]">
                  {formatDate(customer.lastOrderDate)}
                </td>
                <td className="px-6 py-4 text-[#b2a491]">
                  {formatDate(customer.createdAt)}
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[#b2a491]">
                  {searchQuery ? 'No customers match your search.' : 'No customers found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-surface rounded-2xl border border-[#502d26]/30 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#502d26]/30">
              <div>
                <h3 className="text-xl font-bold text-[#ede8df]">
                  {selectedCustomer.customer.firstName || selectedCustomer.customer.lastName
                    ? `${selectedCustomer.customer.firstName || ''} ${selectedCustomer.customer.lastName || ''}`.trim()
                    : 'Guest Customer'}
                </h3>
                <div className="text-sm text-[#b2a491]">{selectedCustomer.customer.email}</div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-[#b2a491] hover:text-[#ede8df] hover:bg-[#302927]/40 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-[#b2a491]">Loading purchase history...</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Customer Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-[#502d26]/30">
                  <div>
                    <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Total Orders</div>
                    <div className="text-xl font-bold text-[#ede8df]">{selectedCustomer.stats.totalOrders}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Total Spent</div>
                    <div className="text-xl font-bold text-emerald-400">{formatCurrency(selectedCustomer.stats.totalSpent)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Average Order</div>
                    <div className="text-xl font-bold text-[#ede8df]">{formatCurrency(selectedCustomer.stats.averageOrderValue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#b2a491] uppercase tracking-wide mb-1">Customer Since</div>
                    <div className="text-xl font-bold text-[#ede8df]">{formatDate(selectedCustomer.stats.firstOrderDate)}</div>
                  </div>
                </div>

                {/* Order History */}
                <div className="p-6">
                  <h4 className="text-lg font-semibold text-[#ede8df] mb-4">Order History</h4>
                  {selectedCustomer.orders.length === 0 ? (
                    <div className="text-center text-[#b2a491] py-8">No orders found.</div>
                  ) : (
                    <div className="space-y-4">
                      {selectedCustomer.orders.map((order) => (
                        <div key={order.id} className="bg-[#201d1c]/50 rounded-xl border border-[#502d26]/20 overflow-hidden">
                          {/* Order Header */}
                          <div className="flex items-center justify-between px-4 py-3 bg-[#302927]/30">
                            <div className="flex items-center gap-4">
                              <span className="font-medium text-[#ede8df]">#{order.orderNumber || order.id.slice(0, 8)}</span>
                              <span className={`px-2 py-0.5 text-xs rounded border ${getStatusBadge(order.status)}`}>
                                {order.status}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded border ${getStatusBadge(order.fulfillmentStatus)}`}>
                                {order.fulfillmentStatus}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-[#ede8df]">{formatCurrency(order.totalAmount, order.currency)}</div>
                              <div className="text-xs text-[#b2a491]">{formatDate(order.createdAt)}</div>
                            </div>
                          </div>

                          {/* Order Items */}
                          <div className="divide-y divide-[#502d26]/20">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    className="w-12 h-12 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-[#302927]/50 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-[#b2a491]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-[#ede8df] truncate">{item.title}</div>
                                  {item.variantTitle && (
                                    <div className="text-xs text-[#b2a491]">{item.variantTitle}</div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-[#ede8df]">{formatCurrency(item.price)} × {item.quantity}</div>
                                  <div className="text-xs text-[#b2a491]">{formatCurrency(item.totalPrice)}</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Order Summary */}
                          <div className="px-4 py-3 bg-[#302927]/20 text-sm space-y-1">
                            <div className="flex justify-between text-[#b2a491]">
                              <span>Subtotal</span>
                              <span>{formatCurrency(order.subtotalAmount, order.currency)}</span>
                            </div>
                            {order.shippingAmount > 0 && (
                              <div className="flex justify-between text-[#b2a491]">
                                <span>Shipping</span>
                                <span>{formatCurrency(order.shippingAmount, order.currency)}</span>
                              </div>
                            )}
                            {order.taxAmount > 0 && (
                              <div className="flex justify-between text-[#b2a491]">
                                <span>Tax</span>
                                <span>{formatCurrency(order.taxAmount, order.currency)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
