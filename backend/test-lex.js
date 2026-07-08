import { scoreTextMatch, normalizeText } from './src/services/smartResponder.js';
const query = normalizeText("Order karva mate kai details aapvi padse?");
const phrasing = "Order confirm karva mate kaya details jaruri chhe?";
console.log(scoreTextMatch(query, phrasing));
