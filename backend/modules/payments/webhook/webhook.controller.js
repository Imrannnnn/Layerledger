/**
 * LayerLedger Webhook Controller
 * Adheres to Principles:
 * #6 (Webhooks), #7 (Signature Verification), #24 (Fast Response), #48 (Never Expose Internal Errors)
 */

const webhookService = require('./webhook.service');
const { ERROR_CODES } = require('../payment.constants');

const handlePaystackWebhook = async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!signature) {
        return res.status(401).json({
            status: 'error',
            code: ERROR_CODES.INVALID_SIGNATURE,
            message: 'Missing webhook signature header'
        });
    }

    try {
        const result = await webhookService.handleWebhook(rawBody, signature, req.body);
        return res.status(200).json(result);
    } catch (err) {
        console.error('[Payment Webhook Error]:', err.message);

        if (err.code === ERROR_CODES.INVALID_SIGNATURE) {
            return res.status(401).json({
                status: 'error',
                code: ERROR_CODES.INVALID_SIGNATURE,
                message: 'Invalid webhook signature'
            });
        }

        // Return 200 to gateway if internal processing failed after signature validation,
        // preventing infinite gateway retries, but logged internally for retry (#24, #48)
        return res.status(200).json({
            status: 'accepted',
            message: 'Webhook received; processing logged'
        });
    }
};

module.exports = {
    handlePaystackWebhook
};
