'use strict';

const axios = require('axios');

const GRAPHQL_URL = 'https://www.homedepot.com/federation-gateway/graphql';
const STORE_LOCATOR_URL = 'https://www.homedepot.com/api/v2/storeinfo/nearByStores';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  'x-experience-name': 'general-merchandise',
  'x-current-url': '/',
  'Referer': 'https://www.homedepot.com/',
  'Origin': 'https://www.homedepot.com',
};

const PRODUCT_QUERY = `
query productClientOnlyProduct($itemId: String!, $storeId: String!) {
  product(itemId: $itemId) {
    pricing(storeId: $storeId) {
      value
      original
      unitOfMeasure
      promotion {
        type
        description
        promotionTag
        dollarOff
        percentageOff
      }
    }
    identifiers {
      productLabel
      itemId
      modelNumber
      brandName
      storeSkuNumber
      upcGtin13
    }
    availabilityType {
      discontinued
      buyable
      type
    }
    media {
      images {
        url
        type
        subType
      }
    }
  }
}`;

// Fetches price of a single item at a single store.
// Returns null if item not found; throws on network error or rate limit.
async function checkItemPrice(itemId, storeId) {
  const resp = await axios.post(
    `${GRAPHQL_URL}?opname=productClientOnlyProduct`,
    {
      operationName: 'productClientOnlyProduct',
      variables: { itemId: String(itemId), storeId: String(storeId) },
      query: PRODUCT_QUERY,
    },
    { headers: HEADERS, timeout: 12000 }
  );

  const product = resp.data?.data?.product;
  if (!product) return null;
  const pricing = product.pricing;
  if (!pricing || pricing.value == null) return null;

  const image = product.media?.images?.find(
    (img) => img.type === 'IMAGE' && img.subType === 'PRIMARY'
  ) || product.media?.images?.[0];

  return {
    itemId: String(itemId),
    storeId: String(storeId),
    price: pricing.value,
    originalPrice: pricing.original ?? null,
    productLabel: product.identifiers?.productLabel ?? 'Unknown Product',
    modelNumber: product.identifiers?.modelNumber ?? null,
    brandName: product.identifiers?.brandName ?? null,
    discontinued: !!product.availabilityType?.discontinued,
    buyable: !!product.availabilityType?.buyable,
    imageUrl: image?.url ?? null,
    isPenny: Math.abs(pricing.value - 0.01) < 0.001,
    hdUrl: `https://www.homedepot.com/p/${String(itemId)}`,
  };
}

// Looks up nearby stores for a given ZIP code (or lat/lon).
async function findStoresByZip(zipCode) {
  try {
    const resp = await axios.get(STORE_LOCATOR_URL, {
      params: {
        zipCode,
        radius: 100,
        units: 'Miles',
        maxStores: 30,
      },
      headers: HEADERS,
      timeout: 10000,
    });

    const stores = resp.data?.stores ?? [];
    return stores.map((s) => ({
      id: String(s.storeId),
      name: `${s.storeName || s.address?.city} ${s.address?.state}`,
      city: s.address?.city ?? '',
      state: s.address?.state ?? '',
      zip: s.address?.postalCode ?? zipCode,
      distance: s.distance ?? null,
    }));
  } catch (err) {
    console.error('[api] store lookup failed for zip', zipCode, err.message);
    return [];
  }
}

// Sleep helper for rate-limit backoff.
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { checkItemPrice, findStoresByZip, sleep };
