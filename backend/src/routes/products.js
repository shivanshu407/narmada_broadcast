import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Product from '../models/Product.js';
import { generateEmbedding } from '../services/smartResponder.js';
import { embeddingForTenant } from '../config/embeddingConfig.js';
import { getUploadsDir } from '../utils/uploads.js';
import { syncProductToMeta, deleteProductFromMeta } from '../services/metaCatalogSync.js';
import Setting from '../models/Setting.js';
import Image from '../models/Image.js';
import {
    parseMetaCataloguePrice,
    sanitizeProductDescriptionForCatalogue,
} from '../utils/productCatalogue.js';

export { parseMetaCataloguePrice } from '../utils/productCatalogue.js';

const router = express.Router();
const PRODUCT_UPLOAD_FIELD = 'images';
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function isAllowedProductImage(file) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    return ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) && ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

function publicUploadUrl(req, filename) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || req.get('host');
    return `${protocol}://${host}/api/v1/products/images/${filename}`;
}

function summarizeMetaPublishResults(results) {
    const failures = results.filter(result => !result?.ok);
    return {
        queued: results.length - failures.length,
        failed: failures.length,
        failures: failures.slice(0, 5).map(result => ({
            sku: result?.contentId || '',
            error: result?.error || 'Unknown Meta sync error'
        }))
    };
}

function runUpload(uploadMiddleware) {
    return (req, res, next) => {
        uploadMiddleware(req, res, (error) => {
            if (!error) return next();
            const message = error instanceof multer.MulterError ? error.message : (error.message || 'Upload failed');
            return res.status(400).json({ error: message });
        });
    };
}

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (isAllowedProductImage(file)) return cb(null, true);
        return cb(new Error('Only JPG, PNG, WebP, or GIF image uploads are allowed'));
    },
});

router.post('/upload-images', runUpload(upload.array(PRODUCT_UPLOAD_FIELD, 10)), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images uploaded' });
        
        const imageUrls = [];
        for (const file of req.files) {
            const originalBase = path.basename(file.originalname || 'image.jpg');
            const safeFilename = originalBase.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filename = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safeFilename}`;
            
            await Image.create({
                filename,
                contentType: file.mimetype,
                data: file.buffer
            });
            
            imageUrls.push(publicUploadUrl(req, filename));
        }
        
        res.json({ image_urls: imageUrls, image_url: imageUrls[0] });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

router.post('/upload-image', runUpload(upload.single('image')), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        
        const file = req.file;
        const originalBase = path.basename(file.originalname || 'image.jpg');
        const safeFilename = originalBase.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safeFilename}`;
        
        await Image.create({
            filename,
            contentType: file.mimetype,
            data: file.buffer
        });
        
        const imageUrl = publicUploadUrl(req, filename);
        return res.json({ image_url: imageUrl, image_urls: [imageUrl] });
    } catch (error) {
        console.error('Single image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

router.get('/images/:filename', async (req, res) => {
    try {
        const image = await Image.findOne({ filename: req.params.filename });
        if (!image) return res.status(404).send('Image not found');
        
        res.set('Content-Type', image.contentType);
        // Cache aggressively since these are static product images
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(image.data);
    } catch (error) {
        res.status(500).send('Error serving image');
    }
});

router.post('/sync-meta', async (req, res) => {
    try {
        const settings = await Setting.findOne({ singletonId: 'admin_settings' });
        if (!settings || !settings.whatsapp_catalog_id || !settings.whatsapp_access_token) {
            return res.status(400).json({ error: 'Catalogue ID or Access Token not configured in Settings.' });
        }

        const catalogId = settings.whatsapp_catalog_id;
        const accessToken = settings.whatsapp_access_token;
        const url = `https://graph.facebook.com/v19.0/${catalogId}/products?fields=id,retailer_id,name,description,price,image_url,availability,inventory,brand&access_token=${accessToken}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('[MetaSync] Graph API Error:', data.error.message);
            return res.status(400).json({ error: data.error.message });
        }

        const items = data.data || [];
        let imported = 0;
        const publishResults = [];

        for (const item of items) {
            const sku = item.retailer_id || item.id;
            // Find if product exists by SKU or Meta ID
            let product = await Product.findOne({
                $or: [
                    { sku },
                    { sku: item.id },
                    { meta_product_id: item.id }
                ]
            });
            
            const price = parseMetaCataloguePrice(item.price);
            const description = sanitizeProductDescriptionForCatalogue(item.description);

            if (!product) {
                product = new Product({
                    name: item.name || 'Untitled',
                    sku,
                    meta_product_id: item.id,
                    description,
                    mrp: price,
                    selling_price: price,
                    image_url: item.image_url || '',
                    images: item.image_url ? [item.image_url] : [],
                    inventory_available: item.availability === 'in stock',
                    inventory_quantity: item.inventory || 100,
                    inventory_policy: 'continue'
                });
            } else {
                product.name = item.name || product.name;
                product.sku = sku || product.sku;
                product.meta_product_id = item.id || product.meta_product_id;
                product.description = description || product.description;
                product.mrp = price || product.mrp;
                product.selling_price = price || product.selling_price;
                product.image_url = item.image_url || product.image_url;
                if (item.image_url && !product.images.includes(item.image_url)) {
                    product.images = [item.image_url, ...product.images];
                }
                product.inventory_available = item.availability === 'in stock';
            }
            await product.save();
            publishResults.push(await syncProductToMeta(product));
            imported++;
        }

        const publishSummary = summarizeMetaPublishResults(publishResults);
        const message = publishSummary.failed > 0
            ? `Synced ${imported} products from Meta. Queued ${publishSummary.queued} for WhatsApp publishing; ${publishSummary.failed} failed.`
            : `Successfully synced ${imported} products from Meta and queued ${publishSummary.queued} for WhatsApp publishing.`;

        res.status(publishSummary.failed > 0 ? 207 : 200).json({
            message,
            imported,
            published: publishSummary.queued,
            failed: publishSummary.failed,
            failures: publishSummary.failures
        });
    } catch (error) {
        console.error('[MetaSync] Sync failed:', error);
        res.status(500).json({ error: 'Failed to sync products from Meta' });
    }
});

router.post('/push-to-meta', async (req, res) => {
    try {
        const products = await Product.find();
        const results = [];
        for (const product of products) {
            results.push(await syncProductToMeta(product));
        }
        const publishSummary = summarizeMetaPublishResults(results);
        const message = publishSummary.failed > 0
            ? `Queued ${publishSummary.queued} products for WhatsApp publishing; ${publishSummary.failed} failed.`
            : `Successfully queued ${publishSummary.queued} products for WhatsApp publishing. They will appear in WhatsApp shortly.`;

        res.status(publishSummary.failed > 0 ? 207 : 200).json({
            message,
            pushed: publishSummary.queued,
            failed: publishSummary.failed,
            failures: publishSummary.failures
        });
    } catch (error) {
        console.error('[MetaSync] Push failed:', error);
        res.status(500).json({ error: 'Failed to push products to Meta' });
    }
});

router.get('/', async (req, res) => {
    try {
        const products = await Product.find().sort({ created_at: -1 });
        res.json({ products: products.map(p => {
            const obj = p.toObject();
            obj.id = obj._id;
            return obj;
        }) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

router.post('/', async (req, res) => {
    try {
        let { name, description, mrp, selling_price, category, sku, image_url, images, available_for_sale, track_inventory, allow_backorder, quantity } = req.body;
        if (!name) return res.status(400).json({ error: 'Product name is required' });
        description = sanitizeProductDescriptionForCatalogue(description);

        if (images && Array.isArray(images) && images.length > 0) {
            image_url = images[0];
        } else if (image_url && !images) {
            images = [image_url];
        }

        let vector = [];
        let embeddingModel = null;
        try {
            const model = embeddingForTenant(req.tenant?.bot_settings || {});
            const searchString = `Product: ${name}\nCategory: ${category || 'General'}\nDescription: ${description || ''}\nPrice: ${selling_price || mrp || ''}`;
            vector = await generateEmbedding(searchString, { modelId: model.modelId, prefix: model.passagePrefix });
            embeddingModel = model.key;
        } catch (embErr) {
            console.warn('[Products] Local embedding generation skipped:', embErr.message);
        }

        const product = new Product({
            name, description: description || '', mrp: mrp || 0, selling_price: selling_price || 0,
            category: category || '', sku: sku || '', image_url: image_url || '', images: images || [],
            product_vector: vector,
            embedding_model: embeddingModel,
            inventory_available: available_for_sale !== false,
            inventory_quantity: quantity != null ? Number(quantity) : null,
            inventory_policy: allow_backorder ? 'continue' : 'deny',
        });
        await product.save();
        
        // Sync to Meta Catalog asynchronously
        syncProductToMeta(product);

        res.status(201).json({ message: 'Product added successfully!', id: product._id });
    } catch (error) {
        console.error('[Products] Failed to add product:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { name, description, mrp, selling_price, category, sku, image_url, images, available_for_sale, track_inventory, allow_backorder, quantity } = req.body;

        if (!name) return res.status(400).json({ error: 'Product name is required' });
        description = sanitizeProductDescriptionForCatalogue(description);

        if (images && Array.isArray(images) && images.length > 0) {
            image_url = images[0];
        } else if (image_url && (!images || images.length === 0)) {
            images = [image_url];
        }

        let vector = [];
        let embeddingModel = null;
        try {
            const model = embeddingForTenant(req.tenant?.bot_settings || {});
            const searchString = `Product: ${name}\nCategory: ${category || 'General'}\nDescription: ${description || ''}\nPrice: ${selling_price || mrp || ''}`;
            vector = await generateEmbedding(searchString, { modelId: model.modelId, prefix: model.passagePrefix });
            embeddingModel = model.key;
        } catch (embErr) {
            console.warn('[Products] Local embedding generation skipped:', embErr.message);
        }

        const updateData = {
            name, description: description || '', mrp: mrp || 0, selling_price: selling_price || 0,
            category: category || '', sku: sku || '', image_url: image_url || '', images: images || [],
            inventory_available: available_for_sale !== false,
            inventory_quantity: quantity != null ? Number(quantity) : null,
            inventory_policy: allow_backorder ? 'continue' : 'deny',
        };
        if (vector.length > 0) updateData.product_vector = vector;
        if (embeddingModel) updateData.embedding_model = embeddingModel;

        const product = await Product.findByIdAndUpdate(id, updateData, { new: true });

        if (!product) return res.status(404).json({ error: 'Product not found' });
        
        // Sync update to Meta Catalog asynchronously
        syncProductToMeta(product);
        
        res.json({ message: 'Product updated successfully!' });
    } catch (error) {
        console.error('[Products] Failed to update product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        
        // Delete from Meta Catalog asynchronously
        deleteProductFromMeta(product);
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

export default router;
