export const SUPPORT_FEEDBACK_THANK_YOU = 'Thank you for your feedback.';

export const SUPPORT_FEEDBACK_GOOD_ID = 'feedback_good';
export const SUPPORT_FEEDBACK_BAD_ID = 'feedback_bad';

export function parseSupportFeedbackReply({ interactive = null, button = null } = {}) {
    const buttonId = interactive?.button_reply?.id || button?.payload || '';

    if (buttonId === SUPPORT_FEEDBACK_GOOD_ID) return 'good';
    if (buttonId === SUPPORT_FEEDBACK_BAD_ID) return 'bad';

    return null;
}
