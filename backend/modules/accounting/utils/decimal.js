/**
 * LayerLedger Financial Decimal Utilities
 * Provides exact decimal arithmetic and validation for double-entry bookkeeping.
 * Eliminates JavaScript binary floating-point precision errors.
 */

const { Prisma } = require('@prisma/client');

/**
 * Normalizes input to Prisma.Decimal with 2 decimal places.
 * Throws an error if input is invalid.
 */
function toDecimal(val) {
    if (val === null || val === undefined) {
        return new Prisma.Decimal('0.00');
    }
    if (val instanceof Prisma.Decimal) {
        return val.toDecimalPlaces(2);
    }
    if (typeof val === 'number') {
        if (!isFinite(val) || isNaN(val)) {
            throw new Error(`Invalid numeric value: ${val}`);
        }
        return new Prisma.Decimal(val.toFixed(2));
    }
    if (typeof val === 'string') {
        const cleaned = val.trim().replace(/,/g, '');
        if (!cleaned || isNaN(Number(cleaned))) {
            throw new Error(`Invalid monetary string: "${val}"`);
        }
        return new Prisma.Decimal(cleaned).toDecimalPlaces(2);
    }
    throw new Error(`Unsupported type for financial decimal: ${typeof val}`);
}

/**
 * Checks if a Decimal is exactly zero.
 */
function isZero(decimal) {
    return decimal.isZero();
}

/**
 * Checks if a Decimal is strictly greater than zero.
 */
function isPositive(decimal) {
    return decimal.isPositive() && !decimal.isZero();
}

/**
 * Checks if two Decimals are equal to 2 decimal places.
 */
function equals(a, b) {
    const da = toDecimal(a);
    const db = toDecimal(b);
    return da.equals(db);
}

/**
 * Adds multiple Decimals.
 */
function sum(...vals) {
    return vals.reduce((acc, v) => acc.add(toDecimal(v)), new Prisma.Decimal('0.00'));
}

/**
 * Formats Decimal as fixed 2 decimal string (e.g. "125000.00")
 */
function formatDecimal(val) {
    return toDecimal(val).toFixed(2);
}

module.exports = {
    toDecimal,
    isZero,
    isPositive,
    equals,
    sum,
    formatDecimal
};
