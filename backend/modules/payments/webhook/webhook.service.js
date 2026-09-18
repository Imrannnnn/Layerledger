/**
 * LayerLedger Webhook Service
 * Adheres to Principles:
 * #6 (Webhooks Are Critical), #7 (Verify Webhook Signatures),
 * #8 (Webhook Idempotency), #24 (Fast Webhook Processing)
 */

const PaystackProvider = require('../providers/paystack.provider');
const paymentRepository = require('../payment.repository');
const paymentService = require('../payment.service');
const { ERROR_CODES, PAYMENT_STATES } = require('../payment.constants');

class WebhookService {
    constructor(provider = new PaystackProvider(), repository = paymentRepository, service = paymentService) {
        this.provider = provider;
        this.repository = repository;
        this.paymentService = service;
    }

    /**
     * Process incoming gateway webhook event
     * @param {Buffer|string} rawBody
     * @param {string} signature
     * @param {Object} payload
     */
    async handleWebhook(rawBody, signature, payload) {
        // Principle #7: Verify Webhook Signatures
        const isValidSignature = this.provider.verifyWebhookSignature(rawBody, signature);
        if (!isValidSignature) {
            const err = new Error('Invalid webhook cryptographic signature');
            err.code = ERROR_CODES.INVALID_SIGNATURE;
            err.statusCode = 401;
            throw err;
        }

        const normalized = this.provider.normalizeWebhookPayload(payload);
        const { eventId, eventType, reference } = normalized;
        const providerName = this.provider.providerName;

        // Principle #8: Webhook Idempotency check
        const existingEvent = await this.repository.findWebhookEvent(providerName, eventId);
        if (existingEvent) {
            return {
                status: 'ignored',
                message: 'Duplicate webhook event already processed',
                eventId
            };
        }

        // Record incoming webhook event
        await this.repository.recordWebhookEvent({
            provider: providerName,
            eventId,
            eventType,
            payload,
            signature
        });

        // Principle #24: Process payment update quickly
        try {
            if (eventType === 'charge.success' && reference) {
                const payment = await this.repository.findByReference(reference);
                if (payment && payment.status !== PAYMENT_STATES.SUCCESS) {
                    await this.paymentService.verifyPayment(reference, {
                        actor: 'webhook',
                        source: `${providerName}_webhook`
                    });
                }
            }

            await this.repository.updateWebhookEventStatus(providerName, eventId, 'PROCESSED');

            return {
                status: 'processed',
                eventId,
                reference
            };
        } catch (err) {
            await this.repository.updateWebhookEventStatus(
                providerName,
                eventId,
                'FAILED',
                err.message
            );
            throw err;
        }
    }
}

module.exports = new WebhookService();
