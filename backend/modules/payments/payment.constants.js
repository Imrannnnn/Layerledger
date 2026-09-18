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

module.exports = {
    PAYMENT_STATES,
    REFUND_STATES,
    VALID_STATE_TRANSITIONS,
    ERROR_CODES,
    SUPPORTED_CURRENCIES,
    toMinorUnits,
    toMajorUnits,
    isValidTransition
};
