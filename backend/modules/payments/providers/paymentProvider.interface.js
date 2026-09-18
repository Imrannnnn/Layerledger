/**
 * Payment Provider Base Interface / Contract
 * Principle #41: Provider Abstraction
 * Principle #42: Normalize Gateway Responses
 */

class PaymentProviderInterface {
    constructor(providerName) {
        if (new.target === PaymentProviderInterface) {
            throw new TypeError('Cannot construct PaymentProviderInterface instances directly');
        }
        this.providerName = providerName;
    }

    /**
     * Initialize transaction with provider
     * @param {Object} params
     * @param {string} params.reference
     * @param {number} params.amountInMinorUnits
     * @param {string} params.currency
     * @param {string} params.email
     * @param {string} [params.callbackUrl]
     * @param {Object} [params.metadata]
     * @returns {Promise<{
     *   success: boolean,
     *   provider: string,
     *   providerReference: string,
     *   authorizationUrl: string,
     *   accessCode?: string,
     *   rawResponse: any
     * }>}
     */
    async initializeTransaction(_params) {
        throw new Error('Method initializeTransaction() must be implemented.');
    }

    /**
     * Verify transaction with provider
     * @param {string} reference
     * @returns {Promise<{
     *   success: boolean,
     *   provider: string,
     *   providerReference: string,
     *   amount: number, // minor units (kobo)
     *   currency: string,
     *   status: string, // normalized: 'SUCCESS' | 'FAILED' | 'PENDING' | 'ABANDONED'
     *   providerStatus: string,
     *   paidAt?: string,
     *   channel?: string,
     *   rawResponse: any
     * }>}
     */
    async verifyTransaction(_reference) {
        throw new Error('Method verifyTransaction() must be implemented.');
    }

    /**
     * Process refund with provider
     * @param {Object} params
     * @param {string} params.transactionReference
     * @param {number} params.amountInMinorUnits
     * @param {string} [params.currency]
     * @param {string} [params.reason]
     * @returns {Promise<{
     *   success: boolean,
     *   provider: string,
     *   providerReference: string,
     *   status: string,
     *   rawResponse: any
     * }>}
     */
    async processRefund(_params) {
        throw new Error('Method processRefund() must be implemented.');
    }

    /**
     * Verify cryptographic webhook authenticity
     * @param {Buffer|string} rawBody
     * @param {string} signature
     * @returns {boolean}
     */
    verifyWebhookSignature(_rawBody, _signature) {
        throw new Error('Method verifyWebhookSignature() must be implemented.');
    }

    /**
     * Normalize webhook payload into standardized shape
     * @param {Object} payload
     * @returns {{
     *   eventId: string,
     *   eventType: string,
     *   reference: string,
     *   amount: number, // minor units
     *   currency: string,
     *   status: string,
     *   providerStatus: string,
     *   customerEmail?: string,
     *   rawPayload: any
     * }}
     */
    normalizeWebhookPayload(_payload) {
        throw new Error('Method normalizeWebhookPayload() must be implemented.');
    }
}

module.exports = PaymentProviderInterface;
