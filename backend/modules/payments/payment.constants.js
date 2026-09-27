/**
 * LayerLedger Payment Gateway Constants & State Machine Definitions
 * Adheres to Principles:
 * #5 (Payment State Machine), #11 (Verify Currency), #12 (Store Money Safely), #47 (Error Classification)
 */

const PAYMENT_STATES = {
    PENDING: 'PENDING',
    INITIALIZED: 'INITIALIZED',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    ABANDONED: 'ABANDONED',
    EXPIRED: 'EXPIRED',
    REFUND_PENDING: 'REFUND_PENDING',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
    REFUNDED: 'REFUNDED'
};

const REFUND_STATES = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED'
};

/**
 * Valid state transitions for the payment state machine.
 * Prevents completed payments from reverting to pending (#5).
 */
const VALID_STATE_TRANSITIONS = {
    [PAYMENT_STATES.PENDING]: [
        PAYMENT_STATES.INITIALIZED,
        PAYMENT_STATES.PROCESSING,
        PAYMENT_STATES.FAILED,
        PAYMENT_STATES.CANCELLED
    ],
    [PAYMENT_STATES.INITIALIZED]: [
        PAYMENT_STATES.PROCESSING,
        PAYMENT_STATES.SUCCESS,
        PAYMENT_STATES.FAILED,
        PAYMENT_STATES.ABANDONED,
        PAYMENT_STATES.EXPIRED,
        PAYMENT_STATES.CANCELLED
    ],
    [PAYMENT_STATES.PROCESSING]: [
        PAYMENT_STATES.SUCCESS,
        PAYMENT_STATES.FAILED,
        PAYMENT_STATES.CANCELLED
    ],
    [PAYMENT_STATES.SUCCESS]: [
        PAYMENT_STATES.REFUND_PENDING,
        PAYMENT_STATES.PARTIALLY_REFUNDED,
        PAYMENT_STATES.REFUNDED
    ],
    [PAYMENT_STATES.REFUND_PENDING]: [
        PAYMENT_STATES.PARTIALLY_REFUNDED,
        PAYMENT_STATES.REFUNDED,
        PAYMENT_STATES.SUCCESS // If refund failed/rejected at provider
    ],
    [PAYMENT_STATES.PARTIALLY_REFUNDED]: [
        PAYMENT_STATES.REFUND_PENDING,
        PAYMENT_STATES.PARTIALLY_REFUNDED,
        PAYMENT_STATES.REFUNDED
    ],
    [PAYMENT_STATES.REFUNDED]: [],
    [PAYMENT_STATES.FAILED]: [],
    [PAYMENT_STATES.CANCELLED]: [],
    [PAYMENT_STATES.ABANDONED]: [],
    [PAYMENT_STATES.EXPIRED]: []
};

/**
 * Categorized error taxonomy (#47)
 */
const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    GATEWAY_ERROR: 'GATEWAY_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
    PAYMENT_DECLINED: 'PAYMENT_DECLINED',
    AMOUNT_MISMATCH: 'AMOUNT_MISMATCH',
    CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
    INVALID_SIGNATURE: 'INVALID_SIGNATURE',
    INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    REFUND_LIMIT_EXCEEDED: 'REFUND_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

const SUPPORTED_CURRENCIES = {
    NGN: { code: 'NGN', multiplier: 100, symbol: '₦' },
    USD: { code: 'USD', multiplier: 100, symbol: '$' }
};

/**
 * Convert major financial currency value to integer minor units (kobo/cents).
 * Avoids IEEE-754 floating-point inaccuracies (#12).
 * @param {number} majorAmount 
 * @param {string} currencyCode 
 * @returns {number} integer minor units
 */
const toMinorUnits = (majorAmount, currencyCode = 'NGN') => {
    const curr = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] || SUPPORTED_CURRENCIES.NGN;
    return Math.round(Number(majorAmount) * curr.multiplier);
};

/**
 * Convert integer minor units back to human-readable major currency value.
 * @param {number} minorAmount 
 * @param {string} currencyCode 
 * @returns {number}
 */
const toMajorUnits = (minorAmount, currencyCode = 'NGN') => {
    const curr = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] || SUPPORTED_CURRENCIES.NGN;
    return Number(minorAmount) / curr.multiplier;
};

/**
 * Validate whether a state transition is legal
 * @param {string} currentState 
 * @param {string} nextState 
 * @returns {boolean}
 */
const isValidTransition = (currentState, nextState) => {
    if (currentState === nextState) return true;
    const allowed = VALID_STATE_TRANSITIONS[currentState] || [];
    return allowed.includes(nextState);
};

/**
 * Calculate the Paystack transaction fee to pass to the customer.
 * In Nigeria (NGN):
 * - Transactions under ₦2,500: 1.5% fee (₦100 flat fee waived)
 * - Transactions ₦2,500 and above: 1.5% + ₦100 flat fee
 * - Maximum fee cap: ₦2,000
 *
 * Formula to ensure merchant receives exact base amount A:
 * For A < 2500: Gross = A / (1 - 0.015)
 * For A >= 2500: Gross = (A + 100) / (1 - 0.015)
 * If (Gross - A) > 2000: Gross = A + 2000
 * Fee = Gross - A
 *
 * @param {number} majorAmount 
 * @param {string} currencyCode 
 * @returns {number}
 */
const calculatePaystackFee = (majorAmount, currencyCode = 'NGN') => {
    const A = Number(majorAmount) || 0;
    if (A <= 0) return 0;

    if ((currencyCode || 'NGN').toUpperCase() !== 'NGN') {
        const rate = 0.039;
        const flat = 0.30;
        const gross = (A + flat) / (1 - rate);
        return Math.round((gross - A) * 100) / 100;
    }

    let gross;
    if (A < 2500) {
        gross = A / 0.985;
    } else {
        gross = (A + 100) / 0.985;
    }

    let fee = gross - A;
    if (fee > 2000) {
        fee = 2000;
    }

    return Math.round(fee * 100) / 100;
};

const calculatePaystackGross = (majorAmount, currencyCode = 'NGN') => {
    const A = Number(majorAmount) || 0;
    const fee = calculatePaystackFee(A, currencyCode);
    return Math.round((A + fee) * 100) / 100;
};

const calculatePaystackFeeInMinorUnits = (minorAmount, currencyCode = 'NGN') => {
    const major = toMajorUnits(minorAmount, currencyCode);
    const feeMajor = calculatePaystackFee(major, currencyCode);
    return toMinorUnits(feeMajor, currencyCode);
};

module.exports = {
    PAYMENT_STATES,
    REFUND_STATES,
    VALID_STATE_TRANSITIONS,
    ERROR_CODES,
    SUPPORTED_CURRENCIES,
    toMinorUnits,
    toMajorUnits,
    isValidTransition,
    calculatePaystackFee,
    calculatePaystackGross,
    calculatePaystackFeeInMinorUnits
};
