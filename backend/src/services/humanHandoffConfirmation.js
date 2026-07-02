export const HUMAN_HANDOFF_CONFIRMATION_PROMPT =
    "Sorry, I didn't understand. Do you want me to add a human to resolve your issue?";

export const HUMAN_HANDOFF_CONFIRMATION_YES_ID = 'request_human_yes';
export const HUMAN_HANDOFF_CONFIRMATION_NO_ID = 'request_human_no';

export function buildHumanHandoffConfirmationPrompt() {
    return {
        type: 'button',
        body: { text: HUMAN_HANDOFF_CONFIRMATION_PROMPT },
        action: {
            buttons: [
                { type: 'reply', reply: { id: HUMAN_HANDOFF_CONFIRMATION_YES_ID, title: 'Yes' } },
                { type: 'reply', reply: { id: HUMAN_HANDOFF_CONFIRMATION_NO_ID, title: 'No' } },
            ],
        },
    };
}

export function parseHumanHandoffConfirmationReply({ bodyText = '', interactive = null, button = null } = {}) {
    const buttonId = interactive?.button_reply?.id || button?.payload || '';
    if (buttonId === HUMAN_HANDOFF_CONFIRMATION_YES_ID) return 'yes';
    if (buttonId === HUMAN_HANDOFF_CONFIRMATION_NO_ID) return 'no';

    const normalized = String(bodyText || '').trim().toLowerCase();
    if (/^(yes|y|yeah|yep|sure|ok|okay)\b/.test(normalized)) return 'yes';
    if (/^(no|n|nope|nah|not now|no thanks)\b/.test(normalized)) return 'no';
    return null;
}
