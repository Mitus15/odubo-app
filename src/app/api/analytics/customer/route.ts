import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCustomerOrders } from '@/lib/shopify-customer-api';

/**
 * Customer Analytics API
 * 
 * Provides business intelligence data for reporting and analysis
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const customerToken = cookieStore.get('shopify_customer_token')?.value;

    if (!customerToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch customer orders
    const orders = await getCustomerOrders(customerToken, 100);

    // Calculate analytics
    const analytics = {
      totalOrders: orders.length,
      totalSpent: orders.reduce((sum, order) => 
        sum + parseFloat(order.totalPrice.amount), 0
      ),
      averageOrderValue: orders.length > 0 
        ? orders.reduce((sum, order) => sum + parseFloat(order.totalPrice.amount), 0) / orders.length
        : 0,
      
      // Order status breakdown
      ordersByStatus: orders.reduce((acc: any, order) => {
        const status = order.fulfillmentStatus || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
      
      // Product analytics
      productsPurchased: orders.flatMap(order => 
        order.lineItems.edges.map((edge: any) => ({
          title: edge.node.title,
          quantity: edge.node.quantity,
          price: parseFloat(edge.node.price.amount),
          productType: edge.node.product?.productType,
          vendor: edge.node.product?.vendor
        }))
      ),
      
      // Top products by quantity
      topProducts: getTopProducts(orders),
      
      // Purchase frequency
      firstOrderDate: orders.length > 0 ? orders[orders.length - 1].processedAt : null,
      lastOrderDate: orders.length > 0 ? orders[0].processedAt : null,
      
      // Monthly spending trend
      monthlySpending: getMonthlySpending(orders),
      
      // Customer lifetime value
      customerLifetimeValue: orders.reduce((sum, order) => 
        sum + parseFloat(order.totalPrice.amount), 0
      ),
      
      // Recent orders (last 10)
      recentOrders: orders.slice(0, 10).map(order => ({
        id: order.id,
        number: order.number,
        date: order.processedAt,
        total: parseFloat(order.totalPrice.amount),
        currency: order.totalPrice.currencyCode,
        status: order.fulfillmentStatus,
        itemCount: order.lineItems.edges.length
      }))
    };

    return NextResponse.json(analytics);

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' }, 
      { status: 500 }
    );
  }
}

// Helper: Get top products by purchase quantity
function getTopProducts(orders: any[]) {
  const productCounts: any = {};
  
  orders.forEach(order => {
    order.lineItems.edges.forEach((edge: any) => {
      const product = edge.node;
      const key = product.title;
      
      if (!productCounts[key]) {
        productCounts[key] = {
          title: product.title,
          totalQuantity: 0,
          totalRevenue: 0,
          purchaseCount: 0
        };
      }
      
      productCounts[key].totalQuantity += product.quantity;
      productCounts[key].totalRevenue += product.quantity * parseFloat(product.price.amount);
      productCounts[key].purchaseCount += 1;
    });
  });
  
  return Object.values(productCounts)
    .sort((a: any, b: any) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10);
}

// Helper: Get monthly spending breakdown
function getMonthlySpending(orders: any[]) {
  const monthlyData: any = {};
  
  orders.forEach(order => {
    const date = new Date(order.processedAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        totalSpent: 0,
        orderCount: 0
      };
    }
    
    monthlyData[monthKey].totalSpent += parseFloat(order.totalPrice.amount);
    monthlyData[monthKey].orderCount += 1;
  });
  
  return Object.values(monthlyData).sort((a: any, b: any) => 
    b.month.localeCompare(a.month)
  );
}