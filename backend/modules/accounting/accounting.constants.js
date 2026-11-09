/**
 * LayerLedger Accounting Constants
 * Standard Chart of Accounts (58 accounts per BakeWealth accounting build spec),
 * Classifications, Source Types, and Accounting Invariants.
 */

const ACCOUNT_CLASSIFICATIONS = {
    ASSET: 'ASSET',
    LIABILITY: 'LIABILITY',
    EQUITY: 'EQUITY',
    REVENUE: 'REVENUE',
    COGS: 'COGS',
    ADMIN_EXPENSE: 'ADMIN_EXPENSE',
    OTHER_INCOME: 'OTHER_INCOME',
    OTHER_EXPENSE: 'OTHER_EXPENSE'
};

const ACCOUNT_TYPES = {
    CURRENT_ASSET: 'CURRENT_ASSET',
    INVENTORY: 'INVENTORY',
    FIXED_ASSET: 'FIXED_ASSET',
    FIXED_ASSET_CONTRA: 'FIXED_ASSET_CONTRA',
    INTANGIBLE_NON_CURRENT_ASSET: 'INTANGIBLE_NON_CURRENT_ASSET',
    CURRENT_LIABILITY: 'CURRENT_LIABILITY',
    LONG_TERM_LIABILITY: 'LONG_TERM_LIABILITY',
    EQUITY: 'EQUITY',
    INCOME: 'INCOME',
    COGS: 'COGS',
    EXPENSE: 'EXPENSE',
    OTHER_REVENUE: 'OTHER_REVENUE',
    OTHER_EXPENSE: 'OTHER_EXPENSE'
};

const SOURCE_TYPES = {
    ORDER_DEPOSIT: 'order_deposit',
    ORDER_BAKE: 'order_bake',
    ORDER_DELIVERY: 'order_delivery',
    ORDER_PAYMENT: 'order_payment',
    ORDER_CANCELLATION: 'order_cancellation',
    PURCHASE: 'purchase',
    EXPENSE: 'expense',
    FIXED_ASSET_PURCHASE: 'fixed_asset_purchase',
    DEPRECIATION: 'depreciation',
    PREPAYMENT_RELEASE: 'prepayment_release',
    OWNER_CAPITAL: 'owner_capital',
    OWNER_LOAN: 'owner_loan',
    OWNER_DRAW: 'owner_draw',
    BANK_TRANSFER: 'bank_transfer',
    REVERSAL: 'reversal',
    MANUAL: 'manual',
    OPENING_BALANCE: 'opening_balance'
};

const ENTRY_STATUS = {
    POSTED: 'POSTED',
    REVERSED: 'REVERSED'
};

const DEFAULT_CAPITALISATION_THRESHOLD = 50000; // ₦50,000 NGN
const DEFAULT_USEFUL_LIFE_MONTHS = 60; // 5 years

/**
 * Standard Chart of Accounts seeded for every tenant.
 * Note the 1240/1290 conflict resolution:
 * 1240 = Leasehold Improvements
 * 1290 = Accumulated Depreciation, PPE
 * 1295 = Accumulated Amortisation, Intangibles
 */
const STANDARD_CHART_OF_ACCOUNTS = [
    // ----------------------------------------------------
    // ASSETS (1000s)
    // ----------------------------------------------------
    {
        accountCode: '1100',
        accountName: 'Cash on Hand',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.CURRENT_ASSET,
        description: 'Physical cash in cash drawer or petty cash box'
    },
    {
        accountCode: '1110',
        accountName: 'Bank',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.CURRENT_ASSET,
        description: 'Bank account funds (one sub-account per bank account)'
    },
    {
        accountCode: '1120',
        accountName: 'Accounts Receivable',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.CURRENT_ASSET,
        description: 'Amounts owed by customers for delivered but unpaid orders'
    },
    {
        accountCode: '1130',
        accountName: 'Other Receivable & Prepaid Expenses',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.CURRENT_ASSET,
        description: 'Prepaid rent, insurance, prepaid internet, and other advances'
    },
    {
        accountCode: '1140',
        accountName: 'Inventory, Raw Materials',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.INVENTORY,
        description: 'Baking ingredients in store (flour, sugar, butter, eggs, flavors)'
    },
    {
        accountCode: '1150',
        accountName: 'Inventory, Packaging Materials',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.INVENTORY,
        description: 'Cake boxes, boards, bags, cups, ribbons'
    },
    {
        accountCode: '1160',
        accountName: 'Inventory, Finished Goods',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.INVENTORY,
        description: 'Baked goods ready and awaiting delivery/collection'
    },
    {
        accountCode: '1200',
        accountName: 'Bakery Equipment',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.FIXED_ASSET,
        description: 'Ovens, mixers, provers, refrigerators, display chillers'
    },
    {
        accountCode: '1210',
        accountName: 'Motor Vehicles',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.FIXED_ASSET,
        description: 'Delivery vans, dispatch bikes, company cars'
    },
    {
        accountCode: '1220',
        accountName: 'Furniture & Fixtures',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.FIXED_ASSET,
        description: 'Bakery worktables, shelves, retail counter furniture'
    },
    {
        accountCode: '1230',
        accountName: 'Computer Equipment',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.FIXED_ASSET,
        description: 'POS tablets, laptops, receipt printers, barcode scanners'
    },
    {
        accountCode: '1240',
        accountName: 'Leasehold Improvements',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.FIXED_ASSET,
        description: 'Bakery store renovations, tiling, electrical and plumbing installations'
    },
    {
        accountCode: '1280',
        accountName: 'Intangible Asset',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.INTANGIBLE_NON_CURRENT_ASSET,
        description: 'Software licenses, trademarks, proprietary brand assets'
    },
    {
        accountCode: '1290',
        accountName: 'Accumulated Depreciation, PPE',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.FIXED_ASSET_CONTRA,
        description: 'Contra-asset accumulating straight-line depreciation of plant, property & equipment'
    },
    {
        accountCode: '1295',
        accountName: 'Accumulated Amortisation, Intangibles',
        classification: ACCOUNT_CLASSIFICATIONS.ASSET,
        accountType: ACCOUNT_TYPES.FIXED_ASSET_CONTRA,
        description: 'Contra-asset accumulating straight-line amortisation of intangible assets'
    },

    // ----------------------------------------------------
    // LIABILITIES (2000s)
    // ----------------------------------------------------
    {
        accountCode: '2100',
        accountName: 'Accounts Payable',
        classification: ACCOUNT_CLASSIFICATIONS.LIABILITY,
        accountType: ACCOUNT_TYPES.CURRENT_LIABILITY,
        description: 'Short-term amounts owed to suppliers for ingredients and packaging'
    },
    {
        accountCode: '2110',
        accountName: 'Other Payable & Customer Deposits',
        classification: ACCOUNT_CLASSIFICATIONS.LIABILITY,
        accountType: ACCOUNT_TYPES.CURRENT_LIABILITY,
        description: 'General short-term obligations and payables'
    },
    {
        accountCode: '2120',
        accountName: 'Customer Deposits',
        classification: ACCOUNT_CLASSIFICATIONS.LIABILITY,
        accountType: ACCOUNT_TYPES.CURRENT_LIABILITY,
        description: 'Advance payments received from customers for undelivered orders (deferred revenue)'
    },
    {
        accountCode: '2130',
        accountName: 'Owner Account, money owed back',
        classification: ACCOUNT_CLASSIFICATIONS.LIABILITY,
        accountType: ACCOUNT_TYPES.CURRENT_LIABILITY,
        description: 'Business funds owed back to the owner for out-of-pocket business spending'
    },
    {
        accountCode: '2200',
        accountName: 'Long-Term Loan',
        classification: ACCOUNT_CLASSIFICATIONS.LIABILITY,
        accountType: ACCOUNT_TYPES.LONG_TERM_LIABILITY,
        description: 'Bank or institutional long-term borrowing'
    },
    {
        accountCode: '2210',
        accountName: "Owner's Loan",
        classification: ACCOUNT_CLASSIFICATIONS.LIABILITY,
        accountType: ACCOUNT_TYPES.LONG_TERM_LIABILITY,
        description: 'Loan injected into the business by the owner with repayment terms'
    },
    {
        accountCode: '2400',
        accountName: 'VAT Payable, dormant',
        classification: ACCOUNT_CLASSIFICATIONS.LIABILITY,
        accountType: ACCOUNT_TYPES.CURRENT_LIABILITY,
        description: 'Value Added Tax collected on sales owed to tax authorities'
    },

    // ----------------------------------------------------
    // EQUITY (3000s)
    // ----------------------------------------------------
    {
        accountCode: '3000',
        accountName: 'Share Capital (Opening)',
        classification: ACCOUNT_CLASSIFICATIONS.EQUITY,
        accountType: ACCOUNT_TYPES.EQUITY,
        description: 'Initial equity capital injected at inception or cut-over'
    },
    {
        accountCode: '3100',
        accountName: 'Additional Capital',
        classification: ACCOUNT_CLASSIFICATIONS.EQUITY,
        accountType: ACCOUNT_TYPES.EQUITY,
        description: 'Subsequent equity contributions made by business owners'
    },
    {
        accountCode: '3200',
        accountName: 'Retained Earnings',
        classification: ACCOUNT_CLASSIFICATIONS.EQUITY,
        accountType: ACCOUNT_TYPES.EQUITY,
        description: 'Cumulative profits retained in the business over time'
    },
    {
        accountCode: '3300',
        accountName: "Shareholders' Drawings",
        classification: ACCOUNT_CLASSIFICATIONS.EQUITY,
        accountType: ACCOUNT_TYPES.EQUITY,
        description: 'Personal non-repayable withdrawals made by the owner'
    },

    // ----------------------------------------------------
    // REVENUE (4000s)
    // ----------------------------------------------------
    {
        accountCode: '4000',
        accountName: 'Cake, Bread & Pastry Sales',
        classification: ACCOUNT_CLASSIFICATIONS.REVENUE,
        accountType: ACCOUNT_TYPES.INCOME,
        description: 'Revenue earned from retail baked goods upon delivery'
    },
    {
        accountCode: '4040',
        accountName: 'Catering or Custom Orders',
        classification: ACCOUNT_CLASSIFICATIONS.REVENUE,
        accountType: ACCOUNT_TYPES.INCOME,
        description: 'Revenue earned from custom celebration cakes and event catering upon delivery'
    },
    {
        accountCode: '4060',
        accountName: 'Delivery Income',
        classification: ACCOUNT_CLASSIFICATIONS.REVENUE,
        accountType: ACCOUNT_TYPES.INCOME,
        description: 'Fees billed to customers for delivery logistics upon order dispatch'
    },
    {
        accountCode: '4070',
        accountName: 'Event Planning & Management',
        classification: ACCOUNT_CLASSIFICATIONS.REVENUE,
        accountType: ACCOUNT_TYPES.INCOME,
        description: 'Revenue earned from event dessert table setup and coordination'
    },

    // ----------------------------------------------------
    // COST OF GOODS SOLD (5000s)
    // ----------------------------------------------------
    {
        accountCode: '5000',
        accountName: 'Raw Materials',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Direct cost of ingredients consumed in delivered orders'
    },
    {
        accountCode: '5010',
        accountName: 'Packaging Items',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Direct packaging materials consumed upon order delivery'
    },
    {
        accountCode: '5020',
        accountName: 'Direct Labor',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Bakers, decorators, and production kitchen staff wages'
    },
    {
        accountCode: '5030',
        accountName: 'Bakery Consumables',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Baking paper, piping bags, sanitizers, foil, gas lighters'
    },
    {
        accountCode: '5040',
        accountName: 'Spoilage & Waste',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Cost of spoiled ingredients or damaged/collapsed baked goods'
    },
    {
        accountCode: '5050',
        accountName: 'Electricity & Gas, Production',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Power and cooking gas utilized directly in baking ovens and mixers'
    },
    {
        accountCode: '5060',
        accountName: 'Depreciation, Production Equipment',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Monthly depreciation of production machinery (sits above gross profit)'
    },
    {
        accountCode: '5070',
        accountName: 'Rent & Occupancy, Production',
        classification: ACCOUNT_CLASSIFICATIONS.COGS,
        accountType: ACCOUNT_TYPES.COGS,
        description: 'Bakery kitchen production space rent (sits above gross profit)'
    },

    // ----------------------------------------------------
    // ADMINISTRATIVE EXPENSES (6000s)
    // ----------------------------------------------------
    {
        accountCode: '6000',
        accountName: 'Salaries & Wages',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Front office, management, and administrative staff compensation'
    },
    {
        accountCode: '6010',
        accountName: 'Rent Expense',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Office / front desk premises rent'
    },
    {
        accountCode: '6020',
        accountName: 'Utilities (Non-Production)',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Office electricity, air conditioning, and waste disposal'
    },
    {
        accountCode: '6030',
        accountName: 'Office Supplies',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Stationery, paper, receipt rolls, pens, office cleaning items'
    },
    {
        accountCode: '6040',
        accountName: 'Maintenance & Repairs',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'General building repairs and routine service'
    },
    {
        accountCode: '6050',
        accountName: 'Internet & Communications',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Internet subscriptions, phone cards, customer service lines'
    },
    {
        accountCode: '6060',
        accountName: 'Insurance Expense',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Fire, burglary, and business liability insurance'
    },
    {
        accountCode: '6070',
        accountName: 'Transportation & Logistics',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Public transit, dispatch errands, marketing travel'
    },
    {
        accountCode: '6080',
        accountName: 'Fuel & Vehicle Maintenance',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Generator diesel/petrol and delivery vehicle repairs'
    },
    {
        accountCode: '6100',
        accountName: 'Advertising & Promotions',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Social media ads, tasting sessions, fliers, sponsorships'
    },
    {
        accountCode: '6120',
        accountName: 'Sales Commission',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Commission paid to agents or delivery coordinators'
    },
    {
        accountCode: '6200',
        accountName: 'Staff Motivation, Medical & Welfare',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Staff meals, first aid, medical bills, employee welfare'
    },
    {
        accountCode: '6210',
        accountName: 'Training & Development',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Baking masterclasses, hygiene certifications, staff courses'
    },
    {
        accountCode: '6220',
        accountName: 'Employee Benefits',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Holiday bonuses, pension contributions, health plans'
    },
    {
        accountCode: '6300',
        accountName: 'Professional Fees, Legal, Accounting & Audit',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Accountant fees, legal retainer, annual audit services'
    },
    {
        accountCode: '6320',
        accountName: 'Regulatory & Compliance Fees',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'NAFDAC, CAC filings, local government business levies'
    },
    {
        accountCode: '6400',
        accountName: 'Depreciation, Office PPE',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Depreciation of office computers and front-of-house furniture'
    },
    {
        accountCode: '6410',
        accountName: 'Amortisation, Intangible Assets',
        classification: ACCOUNT_CLASSIFICATIONS.ADMIN_EXPENSE,
        accountType: ACCOUNT_TYPES.EXPENSE,
        description: 'Monthly amortisation of intangible assets'
    },

    // ----------------------------------------------------
    // OTHER INCOME & OTHER EXPENSES (7000s & 8000s)
    // ----------------------------------------------------
    {
        accountCode: '7000',
        accountName: 'Interest Income',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_INCOME,
        accountType: ACCOUNT_TYPES.OTHER_REVENUE,
        description: 'Bank interest earned on savings or fixed deposits'
    },
    {
        accountCode: '7010',
        accountName: 'Rental Income',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_INCOME,
        accountType: ACCOUNT_TYPES.OTHER_REVENUE,
        description: 'Sub-leasing portion of bakery premises or equipment hire'
    },
    {
        accountCode: '7020',
        accountName: 'Gain on Disposal of Assets',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_INCOME,
        accountType: ACCOUNT_TYPES.OTHER_REVENUE,
        description: 'Surplus realized when selling used equipment above net book value'
    },
    {
        accountCode: '7030',
        accountName: 'Forfeited Deposits',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_INCOME,
        accountType: ACCOUNT_TYPES.OTHER_REVENUE,
        description: 'Customer deposits forfeited on cancelled orders (Other Revenue, keeps gross margin clean)'
    },
    {
        accountCode: '8000',
        accountName: 'Bank Charges',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_EXPENSE,
        accountType: ACCOUNT_TYPES.OTHER_EXPENSE,
        description: 'Electronic transfer fees, maintenance charges, SMS alerts'
    },
    {
        accountCode: '8010',
        accountName: 'Interest Expense',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_EXPENSE,
        accountType: ACCOUNT_TYPES.OTHER_EXPENSE,
        description: 'Interest paid on bank loans or interest-bearing owner loans'
    },
    {
        accountCode: '8020',
        accountName: 'Penalties & Fines',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_EXPENSE,
        accountType: ACCOUNT_TYPES.OTHER_EXPENSE,
        description: 'Regulatory penalties, late tax filing surcharges'
    },
    {
        accountCode: '8030',
        accountName: 'Loss on Disposal of Assets',
        classification: ACCOUNT_CLASSIFICATIONS.OTHER_EXPENSE,
        accountType: ACCOUNT_TYPES.OTHER_EXPENSE,
        description: 'Loss realized when scrapping or selling equipment below net book value'
    }
];

module.exports = {
    ACCOUNT_CLASSIFICATIONS,
    ACCOUNT_TYPES,
    SOURCE_TYPES,
    ENTRY_STATUS,
    DEFAULT_CAPITALISATION_THRESHOLD,
    DEFAULT_USEFUL_LIFE_MONTHS,
    STANDARD_CHART_OF_ACCOUNTS
};
