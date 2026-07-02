# Catalogue

## What This Subsystem Does

The Catalogue subsystem manages the client's local product list, product images,
Meta catalogue import, and WhatsApp customer catalogue publishing. A product can
be visible in the dashboard because it exists in MongoDB, but that does not by
itself prove the product is visible to WhatsApp customers. WhatsApp visibility
depends on queueing the product through the connected Meta catalogue using the
same retailer/content ID that WhatsApp product messages use.

## How It Is Structured

| Path | Responsibility |
|------|----------------|
| `frontend/src/components/Catalogue.jsx` | Product grid, add/edit/delete modal, image upload, Sync from Meta, Publish to WhatsApp. |
| `backend/src/routes/products.js` | Product CRUD, image serving, Meta import, and bulk WhatsApp catalogue publishing routes. |
| `backend/src/services/metaCatalogSync.js` | Low-level Meta `items_batch` upsert/delete helper used by the product routes. |
| `backend/src/utils/productCatalogue.js` | Shared description sanitizer and price normalization helpers for imports, publishing, bot replies, and repair scripts. |
| `backend/src/models/Product.js` | Local Mongo product document, including `sku`, `meta_product_id`, image URLs, prices, and inventory fields. |
| `backend/src/models/Image.js` | Stores uploaded product image binary data in MongoDB so Meta crawlers can fetch stable image URLs on Vercel. |
| `backend/src/routes/webhook.js` | Sends native WhatsApp single-product messages using `whatsapp_catalog_id` and `product.sku`. |

## Conventions And Rules

- Treat `Product.sku` as the WhatsApp product retailer/content ID. The webhook
  uses it as `product_retailer_id` for native product messages.
- Store Meta's Graph product object ID separately as `Product.meta_product_id`;
  do not overwrite `sku` with the Graph ID when `retailer_id` is available.
- `Sync from Meta` imports products from the configured Meta catalogue and now
  also queues those products for WhatsApp customer visibility.
- `Publish to WhatsApp` bulk-queues all local products through the Meta
  `items_batch` API and reports how many queued or failed.
- Do not claim a publish succeeded only because the route looped through
  products. Use the result returned from `syncProductToMeta()`.
- Product descriptions stored locally or sent to Meta must be plain text. Use
  `sanitizeProductDescriptionForCatalogue()` for Meta imports, manual product
  edits, Shopify imports, product bot captions, and embedding text.
- Product prices sent to Meta must go through `formatMetaCataloguePrice()` or
  `productPriceAmount()` so comma-grouped strings and stringified numbers do not
  become tiny truncated amounts.
- Keep product images publicly fetchable through
  `/api/v1/products/images/:filename`; Vercel temp files are not durable enough
  for Meta image crawlers.

## Known Gotchas

- Dashboard visibility and WhatsApp customer visibility are separate states.
  The dashboard can show products imported from Meta even before they are
  queued for WhatsApp publishing.
- The configured `whatsapp_catalog_id` must be the catalogue connected to the
  client's WhatsApp Business account/phone number. If the wrong catalogue is
  configured, the dashboard may still import products while WhatsApp customers
  see a different storefront.
- Meta `items_batch` is asynchronous. A successful queue response means Meta
  accepted the batch job, not that every customer device refreshes instantly.
- If a Meta import was previously saved with the Graph product `id` as `sku`,
  the next import should match by old SKU or `meta_product_id`, then update
  `sku` to `retailer_id` when Meta returns it.
- Meta price strings can include comma grouping, for example `3,499.00 INR`.
  Always normalize with `parseMetaCataloguePrice()` before saving to
  `Product.mrp` or `Product.selling_price`; using the first numeric regex
  fragment will save `3` instead of `3499`.
- If bad prices were already imported and republished into Meta before the
  parser fix, `Sync from Meta` may only return the poisoned value (`3.00 INR`)
  because Meta no longer has the original comma-grouped price. Repair the local
  row from a trusted source, then run `Publish to WhatsApp` to overwrite Meta.
- On 2026-07-02 the live Narmada rows were repaired from the public
  `narmadaessence.com` MRP values: Automatic Dispenser `3699`, Mini Diffuser
  `23099`, and Diffuser `52499`. All local product descriptions were cleaned
  and `Publish to WhatsApp` queued 27 products with 0 failures.
- Products can still fail Meta review or catalogue diagnostics outside this
  app. The API now surfaces first failure messages so operators are not left
  with a false success toast.

## How It Is Tested

- `backend/test/regression.test.js` covers that Meta imports request
  `retailer_id`, preserve `meta_product_id`, queue imported products for
  WhatsApp publishing, parse comma-grouped price strings correctly, strip HTML
  descriptions before publishing/replies, normalize outbound prices, report push
  failures, and show the frontend action as `Publish to WhatsApp`.
- Full local verification for this subsystem should include:
  - `cd backend && npm test`
  - backend `node --check` sweep
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - high-level npm audits for both apps
- Live QA after deploy should run `Sync from Meta` or `Publish to WhatsApp`,
  confirm the toast has `failed: 0`, then check the WhatsApp customer catalogue
  after Meta has processed the batch.

## Related KB Files

- `whatsapp-webhook.md` for native WhatsApp product messages and cart orders.
- `hosted-checkout.md` for checkout/order flows that consume product data.
- `frontend.md` for app-shell and Catalogue UI conventions.
- `testing.md` for the required verification gates.
