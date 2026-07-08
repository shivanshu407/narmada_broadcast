export const DEFAULT_EMBEDDING_MODEL = 'multilingual-e5-small';

export const EMBEDDING_MODELS = {
    'all-MiniLM-L6-v2': {
        key: 'all-MiniLM-L6-v2',
        modelId: 'Xenova/all-MiniLM-L6-v2',
        dim: 384,
        queryPrefix: '',
        passagePrefix: '',
        multilingual: false,
        bands: { high: 0.60, medium: 0.45 },
        label: 'MiniLM-L6 (English · on-device)',
    },
    'multilingual-e5-small': {
        key: 'multilingual-e5-small',
        modelId: 'Xenova/multilingual-e5-small',
        dim: 384,
        queryPrefix: 'query: ',
        passagePrefix: 'passage: ',
        multilingual: true,
        bands: { high: 0.89, medium: 0.82 },
        label: 'Multilingual E5-small (English / Hindi / Gujarati · on-device)',
    },
};

export function getEmbeddingModel(key) {
    return EMBEDDING_MODELS[key] || EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL];
}

export function embeddingForTenant(botSettings) {
    const flags = botSettings && typeof botSettings.flags === 'object' ? botSettings.flags : {};
    const wantKey = flags.embeddings_v2 === true && botSettings && botSettings.embedding_model
        ? botSettings.embedding_model
        : DEFAULT_EMBEDDING_MODEL;
    return getEmbeddingModel(wantKey);
}

export function embeddingTagForTenant(botSettings) {
    return embeddingForTenant(botSettings).key;
}

export function modelMatches(storedModelTag, activeModelKey) {
    const stored = storedModelTag || DEFAULT_EMBEDDING_MODEL;
    return stored === (activeModelKey || DEFAULT_EMBEDDING_MODEL);
}
