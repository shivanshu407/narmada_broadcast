import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const readRepoFile = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');
const importFromRepo = (relativePath) => import(pathToFileURL(resolve(repoRoot, relativePath)).href);
const importFromBackend = (relativePath) => import(pathToFileURL(resolve(repoRoot, 'backend', relativePath)).href);

test('MongoDB connection is environment-owned and has no hardcoded Atlas fallback', async () => {
  const databaseSource = readRepoFile('backend/src/database.js');
  const { resolveMongoUri } = await importFromBackend('src/database.js');

  assert.doesNotMatch(databaseSource, /mongodb\+srv:\/\/[^'"\s]+/);
  assert.match(databaseSource, /MONGO_URI is required/);
  assert.equal(
    resolveMongoUri({ MONGO_URI: 'mongodb://127.0.0.1:27017/client_db' }),
    'mongodb://127.0.0.1:27017/client_db'
  );
  assert.throws(
    () => resolveMongoUri({ NODE_ENV: 'production' }),
    /MONGO_URI is required/
  );
  assert.match(resolveMongoUri({ NODE_ENV: 'development' }), /narmada_broadcast_dev/);
});

test('JWT session validation route exists and frontend does not trust stale persisted auth', () => {
  const authSource = readRepoFile('backend/src/routes/auth.js');
  const storeSource = readRepoFile('frontend/src/stores/store.js');
  const appSource = readRepoFile('frontend/src/App.jsx');

  assert.match(authSource, /router\.get\('\/me',\s*auth/);
  assert.match(storeSource, /validateSession:\s*async/);
  assert.match(storeSource, /api\('\/auth\/me'/);
  assert.match(storeSource, /AUTH_TOKEN_KEY\s*=\s*'narmada_broadcast_token'/);
  assert.doesNotMatch(storeSource, /localStorage\.getItem\('token'\)/);
  assert.doesNotMatch(storeSource, /localStorage\.setItem\('token'/);
  assert.match(storeSource, /narmada-broadcast-storage/);
  assert.match(appSource, /validateSession\(\)/);
  assert.match(appSource, /isAuthReady/);
});

test('tenant settings route exposes Smart Automation and local embedding endpoints used by Settings UI', () => {
  const routeSource = readRepoFile('backend/src/routes/tenant-settings.js');

  for (const pattern of [
    /router\.get\('\/smart-automation\/analytics'/,
    /router\.get\('\/smart-automation\/suggestions'/,
    /router\.get\('\/smart-automation\/score'/,
    /router\.get\('\/smart-automation\/digest'/,
    /router\.post\('\/smart-automation\/test'/,
    /router\.post\('\/smart-automation\/learning\/cluster'/,
    /router\.get\('\/embeddings'/,
    /router\.post\('\/embeddings\/reembed'/,
  ]) {
    assert.match(routeSource, pattern);
  }

  assert.doesNotMatch(routeSource, /AI_API_KEY|api_key_configured|fallback_mode|gemini-text-embedding-004/i);
  assert.match(routeSource, /Object\.values\(EMBEDDING_MODELS\)/);
});

test('knowledge base API matches frontend contracts for list, test console, and phrasings', () => {
  const routeSource = readRepoFile('backend/src/routes/knowledge-base.js');
  const componentSource = readRepoFile('frontend/src/components/KnowledgeBase.jsx');

  assert.match(routeSource, /res\.json\(\{\s*faqs/);
  assert.match(componentSource, /data\.faqs\s*\|\|\s*\[\]/);
  assert.match(routeSource, /router\.post\('\/test'/);
  assert.match(routeSource, /would_reply/);
  assert.match(routeSource, /matched_answer/);
  assert.match(routeSource, /router\.get\('\/:id\/phrasings'/);
  assert.match(routeSource, /router\.post\('\/:id\/phrasings'/);
  assert.match(routeSource, /router\.delete\('\/:id\/phrasings\/:phrasingId'/);
});

test('smart responder uses a writable Transformers cache on serverless deploys', () => {
  const responderSource = readRepoFile('backend/src/services/smartResponder.js');

  assert.match(responderSource, /import\s+fs\s+from\s+['"]node:fs['"]/);
  assert.match(responderSource, /import\s+os\s+from\s+['"]node:os['"]/);
  assert.match(responderSource, /import\s+path\s+from\s+['"]node:path['"]/);
  assert.match(responderSource, /import\s+\{\s*env,\s*pipeline\s*\}\s+from\s+['"]@huggingface\/transformers['"]/);
  assert.match(responderSource, /process\.env\.TRANSFORMERS_CACHE_DIR\s*\|\|\s*path\.join\(os\.tmpdir\(\),\s*['"]narmada-transformers-cache['"]\)/);
  assert.match(responderSource, /env\.cacheDir\s*=\s*TRANSFORMERS_CACHE_DIR/);
  assert.match(responderSource, /fs\.mkdirSync\(TRANSFORMERS_CACHE_DIR,\s*\{\s*recursive:\s*true\s*\}\)/);
  assert.doesNotMatch(responderSource, /node_modules[^\n]+\.cache|\.cache[^\n]+node_modules/i);
});

test('Smart Automation tries FAQ retrieval before no-order human handoff', () => {
  const smartFlowsSource = readRepoFile('backend/src/services/smartFlows.js');
  const responderSource = readRepoFile('backend/src/services/smartResponder.js');

  assert.match(smartFlowsSource, /reason: 'order_not_found'/);
  assert.match(responderSource, /isDeferredFlowReply/);
  assert.match(responderSource, /reply\?\.reason === 'order_not_found'/);
  assert.match(responderSource, /deferredFlowReply = flowReply/);
  assert.match(responderSource, /if \(retrievalReply\) return retrievalReply/);
  assert.match(responderSource, /return legacyReply \|\| deferredFlowReply/);
});

test('Smart Automation asks before escalating unmatched messages to a human', async () => {
  const webhookSource = readRepoFile('backend/src/routes/webhook.js');
  const {
    HUMAN_HANDOFF_CONFIRMATION_PROMPT,
    buildHumanHandoffConfirmationPrompt,
    parseHumanHandoffConfirmationReply,
  } = await importFromBackend('src/services/humanHandoffConfirmation.js');

  assert.equal(
    HUMAN_HANDOFF_CONFIRMATION_PROMPT,
    "Sorry, I didn't understand. Do you want me to add a human to resolve your issue?"
  );
  assert.deepEqual(buildHumanHandoffConfirmationPrompt().action.buttons.map((button) => button.reply.id), [
    'request_human_yes',
    'request_human_no',
  ]);

  assert.equal(parseHumanHandoffConfirmationReply({ bodyText: 'yes' }), 'yes');
  assert.equal(parseHumanHandoffConfirmationReply({ bodyText: 'No thanks' }), 'no');
  assert.equal(
    parseHumanHandoffConfirmationReply({
      interactive: { type: 'button_reply', button_reply: { id: 'request_human_yes', title: 'Yes' } },
    }),
    'yes'
  );
  assert.equal(parseHumanHandoffConfirmationReply({ bodyText: 'where is my order?' }), null);

  assert.match(webhookSource, /parseHumanHandoffConfirmationReply/);
  assert.match(webhookSource, /awaiting_human_confirmation/);
  assert.match(webhookSource, /if \(confirmationReply === 'yes'\)/);
  assert.match(webhookSource, /handoff_reason = 'customer_confirmed_handoff'/);
  assert.match(webhookSource, /if \(confirmationReply === 'no'\)/);
  assert.match(webhookSource, /buildHumanHandoffConfirmationPrompt\(\)/);
  assert.match(webhookSource, /interactionType:\s*'human_handoff_confirmation'/);
});

test('support feedback button replies are acknowledged without Smart Automation', async () => {
  const webhookSource = readRepoFile('backend/src/routes/webhook.js');
  const chatRouteSource = readRepoFile('backend/src/routes/whatsapp-chat.js');
  const {
    SUPPORT_FEEDBACK_THANK_YOU,
    parseSupportFeedbackReply,
  } = await importFromBackend('src/services/supportFeedback.js');

  assert.match(chatRouteSource, /id:\s*['"]feedback_good['"]/);
  assert.match(chatRouteSource, /id:\s*['"]feedback_bad['"]/);
  assert.equal(SUPPORT_FEEDBACK_THANK_YOU, 'Thank you for your feedback.');
  assert.equal(
    parseSupportFeedbackReply({
      interactive: { type: 'button_reply', button_reply: { id: 'feedback_good', title: 'Good' } },
    }),
    'good'
  );
  assert.equal(parseSupportFeedbackReply({ button: { payload: 'feedback_bad', text: 'Bad' } }), 'bad');
  assert.equal(parseSupportFeedbackReply({ bodyText: 'Good' }), null);

  assert.match(webhookSource, /parseSupportFeedbackReply/);
  assert.match(webhookSource, /const supportFeedbackRating = parseSupportFeedbackReply/);
  assert.match(webhookSource, /last_support_feedback/);
  assert.match(webhookSource, /SUPPORT_FEEDBACK_THANK_YOU/);
  assert.match(webhookSource, /support_feedback_received/);
  assert.match(webhookSource, /supportFeedbackRating[\s\S]+continue;[\s\S]+const botSettings = setting\.bot_settings/);
});

test('smart responder can score text-only FAQs when vectors are unavailable', async () => {
  const { scoreTextMatch } = await importFromBackend('src/services/smartResponder.js');

  assert.ok(scoreTextMatch('What are your delivery charges?', 'Delivery charges and shipping fees') >= 0.45);
  assert.ok(scoreTextMatch('blue silk blouse', 'Blue silk blouse with lining') >= 0.45);
  assert.equal(scoreTextMatch('delivery charges', 'return policy warranty'), 0);
});

test('active source and product docs do not require an external AI provider', () => {
  const externalProviderPattern = /gemini|openai|generativelanguage|AI_API_KEY|GEMINI_API_KEY/i;
  const misleadingProductPattern = /AI Assistant|AI chatbot|Chatbot & Hours|AI Status|AI Semantic Engine|Resume AI Bot|Pause AI Bot|AI features/i;
  const checkedFiles = [
    'README.md',
    'backend/package.json',
    'backend/src/config.js',
    'backend/src/config/embeddingConfig.js',
    'backend/src/routes/knowledge-base.js',
    'backend/src/routes/products.js',
    'backend/src/routes/tenant-settings.js',
    'backend/src/services/smartResponder.js',
    'frontend/src/components/KnowledgeBase.jsx',
    'frontend/src/components/Settings.jsx',
    'frontend/src/components/WhatsAppChat.jsx',
    'frontend/src/config/plans.js',
    'frontend/src/stores/store.js',
    'knowledge-base/README.md',
    'knowledge-base/ARCHITECTURE.md',
    'knowledge-base/DEPLOYMENT.md',
    'knowledge-base/DEVELOPMENT_GUIDE.md',
    'knowledge-base/chatbot.md',
    'knowledge-base/security.md',
  ];

  for (const file of checkedFiles) {
    assert.doesNotMatch(readRepoFile(file), externalProviderPattern, `${file} should not imply Gemini/OpenAI/API-key setup`);
  }

  for (const file of [
    'frontend/src/components/KnowledgeBase.jsx',
    'frontend/src/components/Settings.jsx',
    'frontend/src/components/WhatsAppChat.jsx',
    'frontend/src/config/plans.js',
    'frontend/src/stores/store.js',
    'knowledge-base/README.md',
    'knowledge-base/ARCHITECTURE.md',
    'knowledge-base/chatbot.md',
  ]) {
    assert.doesNotMatch(readRepoFile(file), misleadingProductPattern, `${file} should use Smart Automation naming`);
  }

  const backendPackage = JSON.parse(readRepoFile('backend/package.json'));
  assert.equal(backendPackage.dependencies['@huggingface/transformers'], '^4.2.0');
});

test('Razorpay webhook signatures require a valid HMAC over the raw body', async () => {
  const { verifyRazorpayWebhookSignature } = await importFromBackend('src/utils/security.js');
  const rawBody = JSON.stringify({ event: 'payment_link.paid', payload: { payment_link: { entity: { notes: { order_id: '42' } } } } });
  const secret = 'webhook_secret';
  const validSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.equal(verifyRazorpayWebhookSignature(rawBody, validSignature, secret), true);
  assert.equal(verifyRazorpayWebhookSignature(rawBody, 'bad-signature', secret), false);
  assert.equal(verifyRazorpayWebhookSignature(rawBody, validSignature, ''), false);
  assert.equal(verifyRazorpayWebhookSignature('', validSignature, secret), false);
});

test('product image uploads only accept image file types', () => {
  const productsSource = readRepoFile('backend/src/routes/products.js');
  assert.match(productsSource, /ALLOWED_IMAGE_MIME_TYPES/);
  assert.match(productsSource, /fileFilter/);
  assert.match(productsSource, /Only JPG, PNG, WebP, or GIF image uploads are allowed/);
  assert.match(productsSource, /router\.post\('\/upload-image'/);
});

test('public debug chat-status endpoint is not registered', () => {
  const appSource = readRepoFile('backend/src/app.js');
  assert.doesNotMatch(appSource, /app\.get\(['"]\/api\/v1\/debug\/chat-status['"]/);
  assert.doesNotMatch(appSource, /verify_token:\s*process\.env\.WHATSAPP_WEBHOOK_VERIFY_TOKEN/);
});

test('unused lead mailer route is not shipped with a Nodemailer dependency', () => {
  const appSource = readRepoFile('backend/src/app.js');
  const backendPackage = JSON.parse(readRepoFile('backend/package.json'));

  assert.doesNotMatch(appSource, /leadsRoutes|routes\/leads|\/api\/v1\/leads/);
  assert.equal(backendPackage.dependencies.nodemailer, undefined);
});

test('labeled broadcasts are supported by the campaign schema and route', () => {
  const campaignModelSource = readRepoFile('backend/src/models/WhatsAppCampaign.js');
  const whatsappRouteSource = readRepoFile('backend/src/routes/whatsapp.js');

  assert.match(campaignModelSource, /enum:\s*\['all', 'custom', 'labeled', 'tagged', 'filtered'\]/);
  assert.match(whatsappRouteSource, /recipientType === 'labeled'/);
  assert.match(whatsappRouteSource, /baseFilter\.labels\s*=\s*\{\s*\$regex:\s*new RegExp\(recipientFilter\.label,\s*'i'\)\s*\}/);
});

test('Socket chat refresh accepts the backend conversationId event key', () => {
  const storeSource = readRepoFile('frontend/src/stores/store.js');
  assert.match(storeSource, /data\.conversationId\s*\?\?\s*data\.conversation_id/);
  assert.doesNotMatch(storeSource, /activeConversation\.id === data\.conversation_id/);
});

test('bot pause is persisted server-side and webhook auto-reply respects it', () => {
  const conversationModelSource = readRepoFile('backend/src/models/WhatsAppConversation.js');
  const chatRouteSource = readRepoFile('backend/src/routes/whatsapp-chat.js');
  const webhookSource = readRepoFile('backend/src/routes/webhook.js');
  const chatComponentSource = readRepoFile('frontend/src/components/WhatsAppChat.jsx');

  assert.match(conversationModelSource, /bot_paused:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/);
  assert.match(chatRouteSource, /\/conversations\/:id\/bot-pause/);
  assert.match(webhookSource, /conversation\.bot_paused/);
  assert.doesNotMatch(chatComponentSource, /localStorage\.setItem\(BOT_PAUSE_KEY/);
});

test('Chat Inbox handoff resolution and teach actions have backend routes matching the frontend contract', () => {
  const conversationModelSource = readRepoFile('backend/src/models/WhatsAppConversation.js');
  const chatRouteSource = readRepoFile('backend/src/routes/whatsapp-chat.js');
  const storeSource = readRepoFile('frontend/src/stores/store.js');
  const chatComponentSource = readRepoFile('frontend/src/components/WhatsAppChat.jsx');

  assert.match(conversationModelSource, /needs_human:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/);
  assert.match(conversationModelSource, /handoff_reason:\s*\{\s*type:\s*String,\s*default:\s*null\s*\}/);
  assert.match(chatRouteSource, /needs_human\s*={2,3}\s*'1'/);
  assert.match(chatRouteSource, /filter\.needs_human\s*=\s*true/);
  assert.match(storeSource, /\/whatsapp\/chat\/conversations\/\$\{conversationId\}\/handoff\/resolve/);
  assert.match(storeSource, /\/whatsapp\/chat\/conversations\/\$\{conversationId\}\/teach/);
  assert.match(chatComponentSource, /resolveHumanHandoff/);
  assert.match(chatComponentSource, /teachBotFromConversation/);
  assert.match(chatRouteSource, /\/conversations\/:id\/handoff\/resolve/);
  assert.match(chatRouteSource, /needs_human\s*=\s*false/);
  assert.match(chatRouteSource, /bot_paused\s*=\s*false/);
  assert.match(chatRouteSource, /handoff_reason\s*=\s*null/);
  assert.match(chatRouteSource, /handoff_resolved/);
  assert.match(chatRouteSource, /send_feedback/);
  assert.match(chatRouteSource, /\/conversations\/:id\/teach/);
  assert.match(chatRouteSource, /teachFromConversation/);
  assert.match(chatRouteSource, /source_message_id/);
});

test('Chat Inbox exposes one feedback-sending resolve action for handoffs', () => {
  const chatRouteSource = readRepoFile('backend/src/routes/whatsapp-chat.js');
  const chatComponentSource = readRepoFile('frontend/src/components/WhatsAppChat.jsx');

  assert.match(chatComponentSource, /isBotPaused && !isNeedsHuman &&/);
  assert.match(chatComponentSource, /title="Resolve Chat & Send Feedback"/);
  assert.match(chatComponentSource, /title="Resolve Needs Human"/);
  assert.match(chatComponentSource, /setShowResolveHandoffModal\(true\)/);
  assert.match(chatComponentSource, /setShowResolveChatModal\(true\)/);

  assert.match(chatRouteSource, /const wasBotPaused = Boolean\(conv\.bot_paused\)/);
  assert.match(chatRouteSource, /send_feedback && !paused && conv\.needs_human/);
  assert.match(chatRouteSource, /Use Resolve Handoff/);
  assert.match(chatRouteSource, /if \(send_feedback && !paused && wasBotPaused\)/);
  assert.doesNotMatch(chatRouteSource, /if \(send_feedback && !paused\)\s*\{/);
});

test('Chat Inbox keeps the compact header polish and formats Mongo ISO dates safely', async () => {
  const chatComponentSource = readRepoFile('frontend/src/components/WhatsAppChat.jsx');
  const mainCss = readRepoFile('frontend/src/styles/main.css');
  const {
    formatChatTime,
    formatChatFullTime,
    formatChatDateSeparator,
  } = await importFromRepo('frontend/src/utils/chatDates.js');

  const now = new Date('2026-07-02T12:00:00.000Z');

  assert.match(chatComponentSource, /chat-inbox-compact-header/);
  assert.match(chatComponentSource, /chat-inbox-heading/);
  assert.match(chatComponentSource, /chat-inbox-compact-subtitle/);
  assert.match(chatComponentSource, /formatChatTime/);
  assert.match(mainCss, /\.chat-inbox-compact-header/);
  assert.match(mainCss, /\.chat-inbox-heading/);
  assert.match(mainCss, /\.chat-inbox-compact-subtitle/);
  assert.doesNotMatch(formatChatTime('2026-07-02T06:30:00.000Z', now), /Invalid Date/);
  assert.doesNotMatch(formatChatFullTime('2026-07-02T06:30:00.000Z'), /Invalid Date/);
  assert.doesNotMatch(formatChatDateSeparator('2026-07-02T06:30:00.000Z', now), /Invalid Date/);
  assert.doesNotMatch(formatChatTime('2026-07-02 06:30:00', now), /Invalid Date/);
  assert.equal(formatChatTime('not-a-date', now), '');
});

test('Chat Inbox filters commerce-status conversations through Mongo order state', () => {
  const chatRouteSource = readRepoFile('backend/src/routes/whatsapp-chat.js');
  const orderModelSource = readRepoFile('backend/src/models/Order.js');
  const storeSource = readRepoFile('frontend/src/stores/store.js');
  const chatComponentSource = readRepoFile('frontend/src/components/WhatsAppChat.jsx');
  const mainCss = readRepoFile('frontend/src/styles/main.css');

  assert.match(orderModelSource, /tenant_id:\s*\{\s*type:\s*String/);
  assert.match(chatRouteSource, /const allowedConversationFilters = new Set\(\[/);
  assert.match(chatRouteSource, /unpaid_orders/);
  assert.match(chatRouteSource, /abandoned_carts/);
  assert.match(chatRouteSource, /CHECKOUT_ABANDONED_AFTER_MINUTES/);
  assert.match(chatRouteSource, /checkout_status:\s*'ordered'[\s\S]*payment_status:\s*'pending'[\s\S]*payment_link:\s*\{[\s\S]*\$exists:\s*true[\s\S]*\$nin:\s*\[null,\s*''\][\s\S]*\}/);
  assert.match(chatRouteSource, /checkout_status:\s*'open'[\s\S]*payment_status:\s*'pending'[\s\S]*payment_link:\s*\{\s*\$in:\s*\[null,\s*''\]\s*\}/);
  assert.match(chatRouteSource, /has_unpaid_order/);
  assert.match(chatRouteSource, /has_abandoned_cart/);
  assert.match(chatRouteSource, /filter_counts/);

  assert.match(storeSource, /conversationFilterCounts/);
  assert.match(storeSource, /url\.searchParams\.set\('filter', filter\)/);
  assert.match(storeSource, /conversationFilterCounts:\s*data\.filter_counts/);

  assert.match(chatComponentSource, /const \[activeFilter, setActiveFilter\] = useState\('all'\)/);
  assert.match(chatComponentSource, /<select[\s\S]*className="chat-filter-select"/);
  assert.match(chatComponentSource, /Unpaid orders/);
  assert.match(chatComponentSource, /Abandoned carts/);
  assert.match(chatComponentSource, /conversation-chip is-unpaid/);
  assert.match(chatComponentSource, /conversation-chip is-abandoned/);
  assert.doesNotMatch(chatComponentSource, /chat-filter-tabs/);

  assert.match(mainCss, /\.chat-filter-control/);
  assert.match(mainCss, /\.chat-filter-select/);
  assert.match(mainCss, /\.conversation-chip\.is-unpaid/);
  assert.match(mainCss, /\.conversation-chip\.is-abandoned/);
});

test('Chat Inbox has a polling fallback when Vercel sockets are unavailable', () => {
  const chatComponentSource = readRepoFile('frontend/src/components/WhatsAppChat.jsx');

  assert.match(chatComponentSource, /CHAT_INBOX_REFRESH_MS\s*=\s*5000/);
  assert.match(chatComponentSource, /activeFilterRef/);
  assert.match(chatComponentSource, /fetchConversationsRef/);
  assert.match(chatComponentSource, /fetchChatMessagesRef/);
  assert.match(chatComponentSource, /refreshChatInbox/);
  assert.match(chatComponentSource, /setInterval\(refreshChatInbox,\s*CHAT_INBOX_REFRESH_MS\)/);
  assert.match(chatComponentSource, /document\.addEventListener\('visibilitychange'/);
  assert.match(chatComponentSource, /window\.addEventListener\('focus'/);
  assert.match(chatComponentSource, /fetchChatMessagesRef\.current\(currentConversationId\)/);
  assert.doesNotMatch(chatComponentSource, /Polling removed in favor of WebSockets managed in store\.js/);
});

test('tenant settings mask payment secrets before returning to the browser', async () => {
  const { sanitizeBotSettingsForClient, mergeSecretSettings } = await importFromBackend('src/utils/settings-security.js');
  const storedSettings = {
    enabled: true,
    razorpay_key_id: 'rzp_live_123',
    razorpay_key_secret: 'super-secret',
    razorpay_webhook_secret: 'webhook-secret',
    payment_link_template: 'Pay here',
  };

  assert.deepEqual(sanitizeBotSettingsForClient(storedSettings), {
    enabled: true,
    razorpay_key_id: 'rzp_live_123',
    razorpay_key_secret: '',
    razorpay_webhook_secret: '',
    payment_link_template: 'Pay here',
    has_razorpay_key_secret: true,
    has_razorpay_webhook_secret: true,
  });

  assert.deepEqual(mergeSecretSettings(storedSettings, {
    razorpay_key_id: 'rzp_live_456',
    razorpay_key_secret: '',
    razorpay_webhook_secret: '',
    payment_link_template: 'Updated',
  }), {
    enabled: true,
    razorpay_key_id: 'rzp_live_456',
    razorpay_key_secret: 'super-secret',
    razorpay_webhook_secret: 'webhook-secret',
    payment_link_template: 'Updated',
  });
});

test('deployment docs use placeholders instead of production-looking secrets', () => {
  const deploymentDoc = readRepoFile('knowledge-base/DEPLOYMENT.md');
  const legacySecretPrefix = 'Wa' + 'Broadcast_';
  assert.doesNotMatch(deploymentDoc, new RegExp(`${legacySecretPrefix}[A-Za-z0-9_!]+`));
  assert.doesNotMatch(deploymentDoc, new RegExp(`IDENTIFIED BY '${legacySecretPrefix}[^']+'`));
  assert.doesNotMatch(deploymentDoc, /mongodb\+srv:\/\/[^<\s]+/);
  assert.match(deploymentDoc, /MONGO_URI=<mongodb-connection-string>/);
  assert.match(deploymentDoc, /JWT_SECRET=<strong-random-jwt-secret>/);
});

test('Catalogue declares hooks before any loading return', () => {
  const catalogueSource = readRepoFile('frontend/src/components/Catalogue.jsx');
  const hookIndex = catalogueSource.indexOf("const [searchTerm, setSearchTerm] = useState('')");
  const loadingReturnIndex = catalogueSource.indexOf('if (loading)');

  assert.ok(hookIndex > -1, 'search hook exists');
  assert.ok(loadingReturnIndex > -1, 'loading return exists');
  assert.ok(hookIndex < loadingReturnIndex, 'search/sort/filter hooks must be declared before loading return');
});

test('mobile app shell exposes an openable drawer and avoids misleading admin nav', () => {
  const sidebarSource = readRepoFile('frontend/src/components/Sidebar.jsx');
  const mainCss = readRepoFile('frontend/src/styles/main.css');
  const storeSource = readRepoFile('frontend/src/stores/store.js');

  assert.match(sidebarSource, /sidebar--open/);
  assert.match(mainCss, /\.sidebar\.sidebar--open\s*\{\s*transform:\s*translateX\(0\)/);
  assert.doesNotMatch(sidebarSource, /user\?\.role\s*===\s*['"]admin['"]/);
  assert.match(storeSource, /currentView:\s*['"]overview['"]/);
});

test('Orders provides a mobile card surface instead of only a wide table', () => {
  const ordersSource = readRepoFile('frontend/src/components/Orders.jsx');
  const mainCss = readRepoFile('frontend/src/styles/main.css');

  assert.match(ordersSource, /orders-table-card/);
  assert.match(ordersSource, /orders-mobile-list/);
  assert.match(ordersSource, /orders-mobile-card/);
  assert.match(mainCss, /\.orders-mobile-list/);
});

test('Vite dev proxy targets the backend default port and can be overridden for QA', () => {
  const viteConfig = readRepoFile('frontend/vite.config.js');
  assert.match(viteConfig, /VITE_DEV_API_PROXY_TARGET/);
  assert.match(viteConfig, /process\.env\.VITE_DEV_API_PROXY_TARGET\s*\|\|\s*['"]http:\/\/localhost:3000['"]/);
  assert.match(viteConfig, /target:\s*apiProxyTarget/);
});
