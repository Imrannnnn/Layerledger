global.IS_REACT_ACT_ENVIRONMENT = true

import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { Dashboard } from '../dashboard/Dashboard.jsx'
import { PandL } from './PandL.jsx'
import { BalanceSheet } from './BalanceSheet.jsx'
import { CashFlow } from './CashFlow.jsx'
import { GeneralLedgerView } from './GeneralLedgerView.jsx'
import * as accountingApi from '../../lib/accountingApi.js'

// Mock accounting API
jest.mock('../../lib/accountingApi.js', () => ({
  fetchDashboardMetrics: jest.fn(),
  fetchProfitLoss: jest.fn(),
  fetchBalanceSheet: jest.fn(),
  fetchCashFlow: jest.fn(),
  fetchTrialBalance: jest.fn(),
  fetchAccounts: jest.fn(),
  fetchAccountLedger: jest.fn(),
  postManualJournalEntry: jest.fn(),
  reverseJournalEntry: jest.fn(),
  bakeOrder: jest.fn(),
  deliverOrder: jest.fn(),
  cancelOrder: jest.fn()
}))

describe('Phase 10: Frontend Accounting Interface Integration', () => {
  let container = null
  let root = null

  beforeEach(() => {
    jest.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    container = null
  })

  test('Dashboard displays the 3 BakeWealth Foundation Metrics', async () => {
    accountingApi.fetchDashboardMetrics.mockResolvedValue({
      foundationMetrics: {
        cashReceivedThisMonth: 850000,
        revenueThisMonth: 620000,
        paidForAndNotDelivered: 230000
      },
      operationalMetrics: {
        cogsThisMonth: 180000,
        operatingExpensesThisMonth: 95000,
        grossProfitThisMonth: 440000,
        netProfitThisMonth: 345000,
        totalCashAndBank: 1450000
      }
    })

    await act(async () => {
      root.render(
        <Dashboard
          productions={[]}
          inventory={[]}
          expenses={[]}
          setView={jest.fn()}
          user={{ role: 'owner', name: 'Baker Test' }}
          tenantInfo={{ tokenBalance: 10 }}
          onboarded={true}
        />
      )
    })

    // Allow async state updates
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(container.textContent).toContain('Cash Received')
    expect(container.textContent).toContain('Revenue')
    expect(container.textContent).toContain('Paid & Not Delivered')
    expect(container.textContent).toContain('Customer Deposits')
    expect(container.textContent).not.toContain('Acct 2120')
    expect(container.textContent).not.toContain('Accts 1100 + 1110')
  })

  test('PandL displays General Ledger Accrual report with formal accounts', async () => {
    accountingApi.fetchProfitLoss.mockResolvedValue({
      revenue: {
        accounts: [
          { accountCode: '4000', accountName: 'Cake Sales', balance: 500000 },
          { accountCode: '4040', accountName: 'Delivery Charges', balance: 25000 }
        ],
        total: 525000
      },
      costOfGoodsSold: {
        accounts: [
          { accountCode: '5000', accountName: 'Raw Materials Used', balance: 140000 },
          { accountCode: '5010', accountName: 'Packaging', balance: 20000 }
        ],
        total: 160000
      },
      grossProfit: 365000,
      grossMarginPercent: 70,
      operatingExpenses: {
        accounts: [
          { accountCode: '6000', accountName: 'Salaries & Wages', balance: 80000 },
          { accountCode: '6020', accountName: 'Utilities & Electricity', balance: 15000 }
        ],
        total: 95000
      },
      operatingProfit: 270000,
      otherIncome: { accounts: [], total: 0 },
      otherExpenses: { accounts: [], total: 0 },
      netProfit: 270000,
      netMarginPercent: 51
    })

    await act(async () => {
      root.render(
        <PandL
          productions={[]}
          expenses={[]}
          company={{ name: 'Sweet Flour Bakery', primaryColor: '#C8912A' }}
        />
      )
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(container.textContent).toContain('General Ledger Accrual')
    expect(container.textContent).toContain('Cake Sales')
    expect(container.textContent).not.toContain('4000 Cake Sales')
    expect(container.textContent).toContain('Raw Materials Used')
    expect(container.textContent).not.toContain('5000 Raw Materials Used')
    expect(container.textContent).toContain('Salaries & Wages')
    expect(container.textContent).not.toContain('6000 Salaries & Wages')
  })

  test('BalanceSheet displays double-entry statement with isBalanced indicator', async () => {
    accountingApi.fetchBalanceSheet.mockResolvedValue({
      currentAssets: {
        accounts: [
          { accountCode: '1110', accountName: 'Bank Accounts', balance: 450000 },
          { accountCode: '1140', accountName: 'Raw Materials', balance: 120000 }
        ],
        total: 570000
      },
      fixedAssets: {
        grossPPE: [
          { accountCode: '1200', accountName: 'Production Equipment', balance: 800000 }
        ],
        grossPPETotal: 800000,
        contraPPE: [
          { accountCode: '1290', accountName: 'Accumulated Depreciation, PPE', balance: 40000 }
        ],
        contraPPETotal: 40000,
        netPPE: 760000
      },
      totalAssets: 1330000,
      currentLiabilities: {
        accounts: [
          { accountCode: '2120', accountName: 'Customer Deposits', balance: 150000 }
        ],
        total: 150000
      },
      longTermLiabilities: {
        accounts: [],
        total: 0
      },
      totalLiabilities: 150000,
      equity: {
        accounts: [
          { accountCode: '3000', accountName: 'Share Capital', balance: 1000000 }
        ],
        currentYearNetProfit: 180000,
        total: 1180000
      },
      totalLiabilitiesAndEquity: 1330000,
      isBalanced: true,
      imbalanceAmount: 0
    })

    await act(async () => {
      root.render(
        <BalanceSheet
          productions={[]}
          expenses={[]}
          inventory={[]}
          transactions={[]}
          company={{ name: 'Sweet Flour Bakery' }}
        />
      )
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(container.textContent).toContain('General Ledger is Perfectly Balanced')
    expect(container.textContent).toContain('Bank Accounts')
    expect(container.textContent).not.toContain('1110 Bank Accounts')
    expect(container.textContent).toContain('Net Fixed Assets (PPE)')
    expect(container.textContent).toContain('Customer Deposits')
    expect(container.textContent).not.toContain('2120 Customer Deposits')
  })

  test('CashFlow displays Operating, Investing, and Financing activities', async () => {
    accountingApi.fetchCashFlow.mockResolvedValue({
      operatingActivities: {
        netProfit: 250000,
        depreciation: 15000,
        workingCapitalChanges: {
          accountsReceivableChange: 0,
          prepaymentsChange: 0,
          rawMaterialsChange: -20000,
          packagingChange: 0,
          accountsPayableChange: 0,
          customerDepositsChange: 50000,
          accruedExpensesChange: 0,
          totalWorkingCapitalChange: 30000
        },
        netCashFromOperatingActivities: 295000
      },
      investingActivities: {
        purchasesOfPPE: 100000,
        proceedsFromDisposal: 0,
        netCashFromInvestingActivities: -100000
      },
      financingActivities: {
        capitalContributions: 0,
        ownerDrawings: 50000,
        loanReceipts: 0,
        loanRepayments: 0,
        netCashFromFinancingActivities: -50000
      },
      summary: {
        netChangeInCash: 145000,
        beginningCash: 300000,
        endingCash: 445000,
        reconciled: true
      }
    })

    await act(async () => {
      root.render(
        <CashFlow
          productions={[]}
          expenses={[]}
          transactions={[]}
          company={{ name: 'Sweet Flour Bakery' }}
        />
      )
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(container.textContent).toContain('Cash Flow from Operating Activities')
    expect(container.textContent).toContain('Cash Flow from Investing Activities')
    expect(container.textContent).toContain('Cash Flow from Financing Activities')
    expect(container.textContent).toContain('Cash & Bank Reconciliation Summary')
  })

  test('GeneralLedgerView renders account ledger and switches to Trial Balance', async () => {
    accountingApi.fetchAccounts.mockResolvedValue([
      { accountCode: '1110', accountName: 'Bank Accounts', classification: 'ASSET' },
      { accountCode: '2120', accountName: 'Customer Deposits', classification: 'LIABILITY' },
      { accountCode: '4000', accountName: 'Cake Sales', classification: 'REVENUE' }
    ])

    accountingApi.fetchAccountLedger.mockResolvedValue({
      account: { accountCode: '1110', accountName: 'Bank Accounts' },
      beginningBalance: 100000,
      periodDebits: 250000,
      periodCredits: 50000,
      endingBalance: 300000,
      lines: [
        {
          id: 'line-1',
          entryDate: '2026-07-15',
          memo: 'Deposit for Wedding Cake',
          sourceType: 'order_deposit',
          debit: 150000,
          credit: 0,
          runningBalance: 250000
        }
      ]
    })

    await act(async () => {
      root.render(
        <GeneralLedgerView company={{ name: 'Sweet Flour Bakery' }} />
      )
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(container.textContent).toContain('Account Ledger')
    expect(container.textContent).toContain('Deposit for Wedding Cake')
    expect(container.textContent).toContain('Trial Balance')
  })
})
