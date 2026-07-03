
import Setting from '../models/Setting.js';
import {
    formatMetaCataloguePrice,
    sanitizeProductDescriptionForCatalogue,
} from '../utils/productCatalogue.js';

/**
 * Syncs a single product to the Meta Commerce Manager Catalog.
 * @param {Object} product - The product document from MongoDB.
 */
export async function syncProductToMeta(product) {
    const contentId = product.sku || product._id.toString();
    try {
        const settings = await Setting.findOne({ singletonId: 'admin_settings' });
        if (!settings || !settings.whatsapp_catalog_id || !settings.whatsapp_access_token) {
            console.log('[MetaCatalogSync] Skipping sync: Catalog ID or Access Token not configured.');
            return { ok: false, skipped: true, contentId, error: 'Catalog ID or Access Token not configured.' };
        }

        const catalogId = settings.whatsapp_catalog_id;
        const accessToken = settings.whatsapp_access_token;
        const url = `https://graph.facebook.com/v19.0/${catalogId}/items_batch`;

        // Determine availability
        const availability = (product.inventory_available !== false && (product.inventory_quantity === null || product.inventory_quantity > 0)) ? 'in stock' : 'out of stock';

        // Ensure image URL is absolute and valid. Fallback to a placeholder if none.
        let imageUrl = product.image_url || product.images?.[0];
        if (!imageUrl) {
            imageUrl = 'https://dummyimage.com/600x600/cccccc/000000&text=No+Image'; // Meta requires an image
        }

        // Format price (Meta expects string format like "100.00 INR")
        const priceString = formatMetaCataloguePrice(product);
        const description = sanitizeProductDescriptionForCatalogue(product.description, product.name || 'No description available.');

        const payload = {
            item_type: 'PRODUCT_ITEM',
            requests: [
                {
                    method: 'UPDATE', // UPDATE acts as an upsert in Meta Catalog Batch API
                    data: {
                        id: contentId,
                        title: product.name || 'Untitled Product',
                        description: description || 'No description available.',
                        availability: availability,
                        condition: 'new',
                        price: priceString,
                        image_link: imageUrl,
                        link: 'https://narmadaessence.com/', // Meta requires a link
                        brand: 'Narmada', // Default brand if none exists
                    }
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            const message = data.error?.message || `Meta API returned HTTP ${response.status}`;
            console.error('[MetaCatalogSync] Meta API Error:', message);
            return { ok: false, contentId, error: message, metaError: data.error || null };
        } else if (data.handles && data.handles.length > 0) {
            console.log(`[MetaCatalogSync] Product ${contentId} queued for sync successfully. Batch ID:`, data.handles[0]);
            return { ok: true, contentId, handle: data.handles[0] };
        } else {
            console.log('[MetaCatalogSync] Unexpected Meta response:', data);
            return { ok: true, contentId, handle: null };
        }
    } catch (error) {
        console.error('[MetaCatalogSync] Failed to sync product:', error.message);
        return { ok: false, contentId, error: error.message };
    }
}

/**
 * Removes a product from the Meta Commerce Manager Catalog.
 * @param {Object} product - The product document from MongoDB.
 */
export async function deleteProductFromMeta(product) {
    const contentId = product.sku || product._id.toString();
    try {
        const settings = await Setting.findOne({ singletonId: 'admin_settings' });
        if (!settings || !settings.whatsapp_catalog_id || !settings.whatsapp_access_token) {
            return { ok: false, skipped: true, contentId, error: 'Catalog ID or Access Token not configured.' };
        }

        const catalogId = settings.whatsapp_catalog_id;
        const accessToken = settings.whatsapp_access_token;
        const url = `https://graph.facebook.com/v19.0/${catalogId}/items_batch`;

        const payload = {
            item_type: 'PRODUCT_ITEM',
            requests: [
                {
                    method: 'DELETE',
                    data: {
                        id: contentId
                    }
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            const message = data.error?.message || `Meta API returned HTTP ${response.status}`;
            console.error('[MetaCatalogSync] Meta API Error on delete:', message);
            return { ok: false, contentId, error: message, metaError: data.error || null };
        } else {
            console.log(`[MetaCatalogSync] Product ${contentId} queued for deletion successfully.`);
            return { ok: true, contentId, handle: data.handles?.[0] || null };
        }
    } catch (error) {
        console.error('[MetaCatalogSync] Failed to delete product from Meta:', error.message);
        return { ok: false, contentId, error: error.message };
    }
}
