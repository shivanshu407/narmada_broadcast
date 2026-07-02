import Product from '../models/Product.js';
import ShopifyConnection from '../models/ShopifyConnection.js';
import IntegrationSyncRun from '../models/IntegrationSyncRun.js';
import Setting from '../models/Setting.js';
import { syncProductToMeta } from './whatsapp.js';
import { sanitizeProductDescriptionForCatalogue } from '../utils/productCatalogue.js';

const SHOPIFY_GRAPHQL_PATH = '/admin/api/2026-04/graphql.json';

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        cursor
        node {
          id
          title
          description
          productType
          vendor
          updatedAt
          featuredImage { url }
          images(first: 5) { edges { node { url } } }
          variants(first: 50) {
            edges {
              cursor
              node {
                id
                title
                sku
                price
                compareAtPrice
                updatedAt
                availableForSale
                inventoryPolicy
                inventoryQuantity
                sellableOnlineQuantity
                image { url }
              }
            }
            pageInfo { hasNextPage }
          }
        }
      }
      pageInfo { hasNextPage }
    }
  }
`;

const PRODUCT_VARIANTS_QUERY = `
  query ProductVariants($productId: ID!, $cursor: String) {
    product(id: $productId) {
      variants(first: 50, after: $cursor) {
        edges {
          cursor
          node {
            id
            title
            sku
            price
            compareAtPrice
            updatedAt
            availableForSale
            inventoryPolicy
            inventoryQuantity
            sellableOnlineQuantity
            image { url }
          }
        }
        pageInfo { hasNextPage }
      }
    }
  }
`;

export function normalizeShopDomain(shopDomain) {
    const raw = String(shopDomain || '').trim().toLowerCase();
    if (!raw) return '';
    return raw
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/\.myshopify\.com$/, '') + '.myshopify.com';
}

function gidTail(gid) {
    return String(gid || '').split('/').pop();
}

function normalizeInventoryQuantity(...values) {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
    }
    return null;
}

function normalizeInventoryPolicy(policy) {
    return String(policy || '').toUpperCase() === 'CONTINUE' ? 'continue' : 'deny';
}

function deriveInventoryAvailable(variant) {
    const inventoryQuantity = normalizeInventoryQuantity(variant?.inventoryQuantity, variant?.sellableOnlineQuantity);
    const inventoryPolicy = normalizeInventoryPolicy(variant?.inventoryPolicy);

    if (variant?.availableForSale === false) return false;
    if (inventoryQuantity !== null && inventoryQuantity <= 0 && inventoryPolicy !== 'continue') return false;
    return true;
}

function tokenStillValid(connection) {
    if (!connection?.access_token) return false;
    if (!connection.client_id || !connection.client_secret) return true;

    const expiresAt = connection.access_token_expires_at
        ? new Date(connection.access_token_expires_at).getTime()
        : 0;
    return Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000;
}

function tenantCanSyncMetaCatalog(tenant) {
    return Boolean(tenant?.whatsapp_catalog_id && tenant?.whatsapp_access_token);
}

export async function getShopifyAccessToken(connection) {
    if (!connection?.shop_domain) {
        throw new Error('Shopify connection is missing shop domain');
    }
    if (tokenStillValid(connection)) {
        return connection.access_token;
    }
    if (!connection.client_id || !connection.client_secret) {
        throw new Error('Shopify connection is missing Client ID or Client Secret');
    }

    const response = await fetch(`https://${connection.shop_domain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: connection.client_id,
            client_secret: connection.client_secret,
        }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
        const detail = body.error_description || body.error || response.statusText;
        throw new Error(`Shopify token exchange failed: ${detail}`);
    }

    const expiresIn = Number(body.expires_in || 86400);
    const expiresAt = new Date(Date.now() + Math.max(60, expiresIn) * 1000);
    await ShopifyConnection.findByIdAndUpdate(connection._id || connection.id, {
        $set: { access_token: body.access_token, access_token_expires_at: expiresAt }
    });

    connection.access_token = body.access_token;
    connection.access_token_expires_at = expiresAt;
    return body.access_token;
}

function productImages(product, variant) {
    const urls = [];
    if (variant?.image?.url) urls.push(variant.image.url);
    if (product?.featuredImage?.url) urls.push(product.featuredImage.url);
    for (const edge of product?.images?.edges || []) {
        if (edge.node?.url && !urls.includes(edge.node.url)) urls.push(edge.node.url);
    }
    return urls;
}

async function shopifyGraphQL(connection, query, variables = {}) {
    const accessToken = await getShopifyAccessToken(connection);
    const response = await fetch(`https://${connection.shop_domain}${SHOPIFY_GRAPHQL_PATH}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors) {
        const detail = body.errors ? JSON.stringify(body.errors) : response.statusText;
        throw new Error(`Shopify API error: ${detail}`);
    }
    return body.data;
}

async function fetchAllProductVariants(connection, product) {
    const variants = [];
    const initialEdges = product?.variants?.edges || [];
    let cursor = null;
    for (const edge of initialEdges) {
        if (edge.node) variants.push(edge.node);
        cursor = edge.cursor || cursor;
    }

    let hasNextPage = Boolean(product?.variants?.pageInfo?.hasNextPage);
    while (hasNextPage) {
        if (!cursor) break;
        const data = await shopifyGraphQL(connection, PRODUCT_VARIANTS_QUERY, {
            productId: product.id,
            cursor,
        });
        const page = data.product?.variants;
        const edges = page?.edges || [];
        if (!edges.length) break;

        for (const edge of edges) {
            if (edge.node) variants.push(edge.node);
            cursor = edge.cursor || cursor;
        }
        hasNextPage = Boolean(page?.pageInfo?.hasNextPage);
    }

    return variants;
}

async function upsertVariantProduct({ tenantId, connectionId, product, variant }) {
    const images = productImages(product, variant);
    const sellingPrice = Number(variant?.price || 0);
    const mrp = Number(variant?.compareAtPrice || sellingPrice || 0);
    const variantTitle = variant?.title && variant.title !== 'Default Title' ? ` - ${variant.title}` : '';
    const name = `${product.title}${variantTitle}`;
    const externalProductId = gidTail(product.id);
    const externalVariantId = gidTail(variant?.id || product.id);
    
    const updateData = {
        name,
        description: sanitizeProductDescriptionForCatalogue(product.description),
        mrp,
        selling_price: sellingPrice,
        category: product.productType || product.vendor || '',
        sku: variant?.sku || externalVariantId,
        image_url: images[0] || '',
        images,
        external_provider: 'shopify',
        external_id: externalProductId,
        external_variant_id: externalVariantId,
        external_updated_at: variant?.updatedAt || product.updatedAt ? new Date(variant?.updatedAt || product.updatedAt) : new Date(),
        source_integration_id: connectionId,
        inventory_quantity: normalizeInventoryQuantity(variant?.inventoryQuantity, variant?.sellableOnlineQuantity),
        inventory_policy: normalizeInventoryPolicy(variant?.inventoryPolicy),
        inventory_available: deriveInventoryAvailable(variant),
        updated_at: new Date()
    };

    const savedProduct = await Product.findOneAndUpdate(
        { external_provider: 'shopify', external_id: externalProductId, external_variant_id: externalVariantId },
        { $set: updateData },
        { upsert: true, new: true }
    );

    return {
        ...updateData,
        id: savedProduct._id.toString(),
        tenant_id: tenantId || 'single-tenant',
        meta_product_id: savedProduct.meta_product_id || null,
    };
}

export async function syncShopifyProducts(connection, { syncRunId = null } = {}) {
    if (!connection?.shop_domain) {
        throw new Error('Shopify connection is incomplete');
    }

    let cursor = null;
    let imported = 0;
    let pages = 0;
    let metaSynced = 0;
    let metaFailed = 0;
    let lastMetaError = null;
    const tenant = await Setting.findOne();
    const shouldSyncMetaCatalog = tenantCanSyncMetaCatalog(tenant);

    while (true) {
        const data = await shopifyGraphQL(connection, PRODUCTS_QUERY, { cursor });
        const page = data.products;
        const edges = page.edges || [];
        pages += 1;
        if (!edges.length) break;
        for (const edge of edges) {
            const product = edge.node;
            const variants = await fetchAllProductVariants(connection, product);
            const productVariants = variants.length ? variants : [{ id: product.id, title: 'Default Title', price: 0, compareAtPrice: 0 }];
            for (const variant of productVariants) {
                const localProduct = await upsertVariantProduct({
                    tenantId: connection.tenant_id || 'single-tenant',
                    connectionId: connection._id || connection.id,
                    product,
                    variant,
                });
                imported += 1;

                if (shouldSyncMetaCatalog) {
                    try {
                        const metaProductId = await syncProductToMeta(tenant, localProduct);
                        if (metaProductId) {
                            await Product.findByIdAndUpdate(localProduct.id, {
                                $set: { meta_product_id: metaProductId }
                            });
                            localProduct.meta_product_id = metaProductId;
                        }
                        metaSynced += 1;
                    } catch (metaError) {
                        metaFailed += 1;
                        lastMetaError = metaError.message || String(metaError);
                        console.warn(`[ShopifySync] Meta catalog sync failed for product ${localProduct.id}: ${lastMetaError}`);
                    }
                }
            }
            cursor = edge.cursor;
        }
        if (!page.pageInfo?.hasNextPage) break;
    }

    const totals = { products: imported, pages, meta_synced: metaSynced, meta_failed: metaFailed };
    if (lastMetaError) totals.meta_error = lastMetaError;
    await ShopifyConnection.findByIdAndUpdate(connection._id || connection.id, {
        $set: { last_sync_at: new Date(), last_sync_status: 'completed', last_sync_error: null }
    });
    if (syncRunId) {
        await IntegrationSyncRun.findByIdAndUpdate(syncRunId, {
            $set: { status: 'completed', totals: totals, completed_at: new Date() }
        });
    }

    return totals;
}

export async function processShopifySyncJob(job) {
    const payload = job.payload || {};
    const connectionId = payload.connectionId;
    const syncRunId = payload.syncRunId || null;
    if (!connectionId) throw new Error('shopify.sync job is missing connectionId');

    if (syncRunId) {
        await IntegrationSyncRun.findByIdAndUpdate(syncRunId, {
            $set: { status: 'running', started_at: new Date() }
        });
    }

    const connection = await ShopifyConnection.findOne({ _id: connectionId, sync_enabled: true });
    if (!connection) throw new Error('Shopify connection not found or disabled');

    try {
        return await syncShopifyProducts(connection, { syncRunId });
    } catch (error) {
        await ShopifyConnection.findByIdAndUpdate(connectionId, {
            $set: { last_sync_at: new Date(), last_sync_status: 'failed', last_sync_error: error.message }
        });
        if (syncRunId) {
            await IntegrationSyncRun.findByIdAndUpdate(syncRunId, {
                $set: { status: 'failed', error: error.message, completed_at: new Date() }
            });
        }
        throw error;
    }
}
