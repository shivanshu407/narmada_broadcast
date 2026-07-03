const HTML_ENTITY_MAP = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    ndash: '-',
    mdash: '-',
};

function decodeHtmlEntities(value) {
    return String(value || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
        const key = entity.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(HTML_ENTITY_MAP, key)) {
            return HTML_ENTITY_MAP[key];
        }

        if (key.startsWith('#x')) {
            const codePoint = Number.parseInt(key.slice(2), 16);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }

        if (key.startsWith('#')) {
            const codePoint = Number.parseInt(key.slice(1), 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }

        return match;
    });
}

export function sanitizeProductDescriptionForCatalogue(value, fallback = '') {
    const raw = value === null || value === undefined ? fallback : value;
    let text = decodeHtmlEntities(raw)
        .replace(/\uFFFD/g, "'")
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
        .replace(/<\s*(p|div|li|ul|ol|h[1-6]|tr|td|th)[^>]*>/gi, ' ')
        .replace(/<[^>]*>/g, ' ');

    text = decodeHtmlEntities(text);

    return text
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

export function parseMetaCataloguePrice(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const priceText = String(value).trim();
    if (!priceText) return 0;

    const matches = priceText.match(/\d[\d,]*(?:\.\d+)?/g);
    if (!matches) return 0;

    for (const match of matches) {
        const amount = Number(match.replace(/,/g, ''));
        if (Number.isFinite(amount)) return amount;
    }
    return 0;
}

export function productPriceAmount(product = {}) {
    const sellingPrice = parseMetaCataloguePrice(product.selling_price);
    if (sellingPrice > 0) return sellingPrice;

    const mrp = parseMetaCataloguePrice(product.mrp);
    return mrp > 0 ? mrp : 0;
}

export function formatMetaCataloguePrice(product = {}) {
    return `${productPriceAmount(product).toFixed(2)} INR`;
}
