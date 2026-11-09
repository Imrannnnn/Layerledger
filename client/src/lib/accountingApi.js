/**
 * LayerLedger Accounting API Client
 * Frontend HTTP client for Double-Entry General Ledger services.
 */

import { getAuthHeaders } from './data.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Standard fetch wrapper with authentication and error handling
 */
async function request(path, options = {}) {
  const headers = getAuthHeaders() || {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const errorMsg = (isJson && data.message) ? data.message : `Accounting API error (${res.status})`;
    const error = new Error(errorMsg);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// FINANCIAL REPORTS
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchDashboardMetrics(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/reports/dashboard${query ? `?${query}` : ''}`);
}

export async function fetchProfitLoss(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/reports/profit-loss${query ? `?${query}` : ''}`);
}

export async function fetchBalanceSheet(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/reports/balance-sheet${query ? `?${query}` : ''}`);
}

export async function fetchCashFlow(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/reports/cash-flow${query ? `?${query}` : ''}`);
}

export async function fetchTrialBalance(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/reports/trial-balance${query ? `?${query}` : ''}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS & GENERAL LEDGER
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchAccounts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/accounts${query ? `?${query}` : ''}`);
}

export async function seedAccounts() {
  return request(`/api/accounting/accounts/seed`, { method: 'POST' });
}

export async function createCustomAccount(accountData) {
  return request(`/api/accounting/accounts`, {
    method: 'POST',
    body: JSON.stringify(accountData)
  });
}

export async function fetchJournalEntries(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/journal${query ? `?${query}` : ''}`);
}

export async function fetchAccountLedger(accountCode, params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/ledger/${encodeURIComponent(accountCode)}${query ? `?${query}` : ''}`);
}

export async function postManualJournalEntry(entryData) {
  return request(`/api/accounting/journal`, {
    method: 'POST',
    body: JSON.stringify(entryData)
  });
}

export async function reverseJournalEntry(journalId, reason) {
  return request(`/api/accounting/journal/${journalId}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDER ACCOUNTING ACTIONS
// ══════════════════════════════════════════════════════════════════════════════

export async function recordOrderDeposit(orderId, paymentData) {
  return request(`/api/accounting/orders/${orderId}/deposit`, {
    method: 'POST',
    body: JSON.stringify(paymentData)
  });
}

export async function bakeOrder(orderId, bakeData = {}) {
  return request(`/api/accounting/orders/${orderId}/bake`, {
    method: 'POST',
    body: JSON.stringify(bakeData)
  });
}

export async function deliverOrder(orderId, deliveryData = {}) {
  return request(`/api/accounting/orders/${orderId}/deliver`, {
    method: 'POST',
    body: JSON.stringify(deliveryData)
  });
}

export async function recordOrderBalancePayment(orderId, paymentData) {
  return request(`/api/accounting/orders/${orderId}/balance-payment`, {
    method: 'POST',
    body: JSON.stringify(paymentData)
  });
}

export async function cancelOrder(orderId, cancellationData) {
  return request(`/api/accounting/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(cancellationData)
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// FIXED ASSETS & PREPAYMENTS
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchFixedAssets(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/fixed-assets${query ? `?${query}` : ''}`);
}

export async function registerFixedAsset(assetData) {
  return request(`/api/accounting/fixed-assets`, {
    method: 'POST',
    body: JSON.stringify(assetData)
  });
}

export async function depreciateAllFixedAssets(data = {}) {
  return request(`/api/accounting/fixed-assets/depreciate-all`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function fetchPrepayments(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/api/accounting/prepayments${query ? `?${query}` : ''}`);
}

export async function releaseAllPrepayments(data = {}) {
  return request(`/api/accounting/prepayments/release-all`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// BANK ACCOUNTS & TRANSFERS
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchBankAccounts() {
  return request(`/api/accounting/bank-accounts`);
}

export async function createBankAccount(accountData) {
  return request(`/api/accounting/bank-accounts`, {
    method: 'POST',
    body: JSON.stringify(accountData)
  });
}

export async function transferBetweenAccounts(transferData) {
  return request(`/api/accounting/bank-transfers`, {
    method: 'POST',
    body: JSON.stringify(transferData)
  });
}

export async function recordManualCashPurchase(purchaseData) {
  return request(`/api/accounting/cash-purchases`, {
    method: 'POST',
    body: JSON.stringify(purchaseData)
  });
}

export async function fetchBankReconciliation(bankAccountId) {
  return request(`/api/accounting/bank-statements/${bankAccountId}/reconciliation`);
}
