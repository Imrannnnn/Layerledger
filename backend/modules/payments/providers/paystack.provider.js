/**
 * Paystack Provider Implementation
 * Adheres to Principles:
 * #7 (Verify Webhook Signatures - HMAC SHA512), #10 (Amount Verification), #11 (Currency Verification),
 * #41 (Provider Abstraction), #42 (Normalize Gateway Responses), #43 (Provider-Agnostic Status),
 * #44 (Store Provider Info), #49 (Graceful Gateway Failure)
 */

const crypto = require('crypto');
const PaymentProviderInterface = require('./paymentProvider.interface');
const { PAYMENT_STATES, ERROR_CODES } = require('../payment.constants');

class PaystackProvider extends PaymentProviderInterface {
    constructor() {
        super('paystack');
        this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
        this.baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
        this.timeoutMs = 12000;
    }

    /**
     * Helper for authorized HTTP requests to Paystack API with timeout
     */
    async _request(endpoint, method = 'GET', body = null) {
        if (!this.secretKey) {
            const error = new Error('Paystack secret key is not configured.');
            error.code = ERROR_CODES.AUTHORIZATION_ERROR;
            throw error;
        }

        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const options = {
                method,
                headers,
                signal: controller.signal
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok || !data.status) {
                const errorMsg = data?.message || `Paystack request failed with status ${response.status}`;
                const err = new Error(errorMsg);
                err.code = ERROR_CODES.GATEWAY_ERROR;
                err.status = response.status;
                err.raw = data;
                throw err;
            }

            return data;
        } catch (err) {
            if (err.name === 'AbortError') {
                const timeoutError = new Error(`Paystack request timed out after ${this.timeoutMs}ms`);
                timeoutError.code = ERROR_CODES.TIMEOUT;
                throw timeoutError;
            }
            if (err.code === ERROR_CODES.GATEWAY_ERROR || err.code === ERROR_CODES.AUTHORIZATION_ERROR) {
                throw err;
            }
            const networkError = new Error(err.message || 'Network error communicating with Paystack');
            networkError.code = ERROR_CODES.NETWORK_ERROR;
            throw networkError;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Initialize transaction with Paystack
     */
    async initializeTransaction({ reference, amountInMinorUnits, currency = 'NGN', email, callbackUrl, metadata = {} }) {
        const payload = {
            reference,
            amount: amountInMinorUnits,
            email,
            currency: currency.toUpperCase(),
            callback_url: callbackUrl,
            metadata
        };

        const result = await this._request('/transaction/initialize', 'POST', payload);

        return {
            success: true,
            provider: 'paystack',
            providerReference: result.data?.reference || reference,
            authorizationUrl: result.data?.authorization_url,
            accessCode: result.data?.access_code,
            rawResponse: result
        };
    }

    /**
     * Verify transaction with Paystack server-side
     */
    async verifyTransaction(reference) {
        const encodedRef = encodeURIComponent(reference);
        const result = await this._request(`/transaction/verify/${encodedRef}`, 'GET');
        const data = result.data || {};

        let normalizedStatus = PAYMENT_STATES.PENDING;
        const providerStatus = (data.status || '').toLowerCase();

        if (providerStatus === 'success') {
            normalizedStatus = PAYMENT_STATES.SUCCESS;
        } else if (providerStatus === 'failed') {
            normalizedStatus = PAYMENT_STATES.FAILED;
        } else if (providerStatus === 'abandoned') {
            normalizedStatus = PAYMENT_STATES.ABANDONED;
        } else if (providerStatus === 'reversed') {
            normalizedStatus = PAYMENT_STATES.REFUNDED;
        }

        return {
            success: data.status === 'success',
            provider: 'paystack',
            providerReference: data.reference || reference,
            amount: data.amount, // in kobo
            requestedAmount: data.requested_amount, // in kobo
            fees: data.fees, // in kobo
            currency: (data.currency || 'NGN').toUpperCase(),
            status: normalizedStatus,
            providerStatus: data.status,
            paidAt: data.paid_at,
            channel: data.channel,
            customerEmail: data.customer?.email,
            gatewayResponse: data.gateway_response,
            rawResponse: result
        };
    }

    /**
     * Process refund with Paystack
     */
    async processRefund({ transactionReference, amountInMinorUnits, reason }) {
        const payload = {
            transaction: transactionReference,
            merchant_note: reason || 'Refund request'
        };

        if (amountInMinorUnits) {
            payload.amount = amountInMinorUnits;
        }

        const result = await this._request('/refund', 'POST', payload);

        return {
            success: true,
            provider: 'paystack',
            providerReference: result.data?.id ? String(result.data.id) : transactionReference,
            status: PAYMENT_STATES.SUCCESS,
            rawResponse: result
        };
    }

    /**
     * Verify webhook signature using cryptographic HMAC SHA512 (#7)
     */
    verifyWebhookSignature(rawBody, signature) {
        if (!this.secretKey || !signature || !rawBody) {
            return false;
        }

        try {
            const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
            const expectedSignature = crypto
                .createHmac('sha512', this.secretKey)
                .update(bodyBuffer)
                .digest('hex');

            // Constant time comparison to prevent timing attacks
            const signatureBuffer = Buffer.from(signature, 'hex');
            const expectedBuffer = Buffer.from(expectedSignature, 'hex');

            if (signatureBuffer.length !== expectedBuffer.length) {
                return false;
            }

            return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
        } catch {
            return false;
        }
    }

    /**
     * Normalize webhook payload
     */
    normalizeWebhookPayload(payload) {
        const eventType = payload?.event || 'charge.success';
        const data = payload?.data || {};

        let normalizedStatus = PAYMENT_STATES.PENDING;
        const providerStatus = (data.status || '').toLowerCase();

        if (providerStatus === 'success') {
            normalizedStatus = PAYMENT_STATES.SUCCESS;
        } else if (providerStatus === 'failed') {
            normalizedStatus = PAYMENT_STATES.FAILED;
        } else if (providerStatus === 'abandoned') {
            normalizedStatus = PAYMENT_STATES.ABANDONED;
        }

        return {
            eventId: payload?.id ? String(payload.id) : (data.reference || `evt_${Date.now()}`),
            eventType,
            reference: data.reference,
            amount: data.amount, // in kobo
            currency: (data.currency || 'NGN').toUpperCase(),
            status: normalizedStatus,
            providerStatus: data.status,
            customerEmail: data.customer?.email,
            rawPayload: payload
        };
    }
}

module.exports = PaystackProvider;
