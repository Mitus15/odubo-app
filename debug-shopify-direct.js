
import 'dotenv/config';

async function check() {
  const STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://odubostudio.myshopify.com';
  const PUBLIC_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  console.log('Store URL:', STORE_URL);
  console.log('Public Token:', PUBLIC_TOKEN ? `${PUBLIC_TOKEN.substring(0, 5)}...` : 'MISSING');

  if (!PUBLIC_TOKEN) {
    console.error('Missing Public Token');
    return;
  }

  const endpoint = `${STORE_URL}/api/2024-07/graphql.json`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': PUBLIC_TOKEN,
  };

  const query = `#graphql
    query Products {
      products(first: 10, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            title
            handle
            availableForSale
            productType
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      console.error('Error:', res.status, await res.text());
      return;
    }

    const data = await res.json();
    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
    } else {
      const products = data.data.products.edges;
      console.log(`Found ${products.length} products.`);
      products.forEach(p => {
        console.log(`- ${p.node.title} (Available: ${p.node.availableForSale})`);
      });
    }
  } catch (e) {
    console.error('Exception:', e);
  }
}

check();
