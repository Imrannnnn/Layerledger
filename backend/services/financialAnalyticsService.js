/**
 * ----------------------------------------------------------------------
 * Financial Analytics Service
 * ----------------------------------------------------------------------
 * Core data retrieval, aggregation, and calculation engine for BakeWealth.
 * Computes Revenue, COGS, Gross Profit, Gross Margin, Overhead Expenses,
 * Net Profit, Net Margin, Product-Level Profitability, MoM Comparisons,
 * and Profitability Drain Analysis directly from verified database records.
 *
 * Strict Tenant Isolation: All database operations require a tenantId.
 * Business Logic: Reuses the system's exact P&L, Monthly Overview, and
 * Order Calculator formulas with zero simulated or mock data.
 * ----------------------------------------------------------------------
 */

const prisma = require('../prisma');

/**
 * Format a number to 2 decimal places or rounded
 */
const round = (val, decimals = 2) => {
    const num = Number(val) || 0;
    return Number(num.toFixed(decimals));
};

/**
 * Check if a date string falls within a specified 'YYYY-MM'
 */
const isDateInMonth = (dateVal, monthStr) => {
    if (!dateVal || !monthStr) return false;
    let s = '';
    if (typeof dateVal === 'string') s = dateVal;
    else if (dateVal instanceof Date) s = dateVal.toISOString();
    return s.slice(0, 7) === monthStr.slice(0, 7);
};

/**
 * Normalizes date from order object
 */
const getOrderDateKey = (order) => {
    if (!order) return '';
    const meta = order.metadata || {};
    if (order.confirmedAt) return new Date(order.confirmedAt).toISOString().slice(0, 10);
    if (meta.confirmedAt) return String(meta.confirmedAt).slice(0, 10);
    if (order.dueDate) return new Date(order.dueDate).toISOString().slice(0, 10);
    if (meta.deliveryDate) return String(meta.deliveryDate).slice(0, 10);
    if (order.orderDate) return new Date(order.orderDate).toISOString().slice(0, 10);
    if (meta.orderDate) return String(meta.orderDate).slice(0, 10);
    if (order.createdAt) return new Date(order.createdAt).toISOString().slice(0, 10);
    return '';
};

/**
 * Determine if an order is confirmed and should be recognized as revenue/production
 */
const isConfirmedOrder = (order) => {
    if (!order) return false;
    const meta = order.metadata || {};
    const st = String(order.status || meta.status || '').toLowerCase();

    if (st === 'cancelled' || st === 'quote') return false;
    if (st === 'confirmed' || st === 'delivered' || st === 'in_production' || st === 'ready') return true;
    if (meta.fromQuote && (meta.confirmedAt || meta.status === 'confirmed')) return true;
    if (meta.isProd === true && st !== 'quote' && st !== 'pending' && st !== 'cancelled') return true;

    // Default: if status is not explicitly cancelled or draft quote, and has price > 0
    return (order.totalPrice > 0 || (meta.salePrice && meta.salePrice > 0)) && st !== 'pending';
};

class FinancialAnalyticsService {
    /**
     * Retrieve all relevant financial records for a tenant
     */
    async fetchTenantFinancialRecords(tenantId) {
        const [tenant, orders, expenses, purchases] = await Promise.all([
            prisma.tenant.findUnique({
                where: { id: tenantId },
                select: {
                    id: true,
                    name: true,
                    settings: true,
                    tokenBalance: true,
                    createdAt: true
                }
            }),
            prisma.order.findMany({
                where: { tenantId },
                include: {
                    items: true,
                    payments: true,
                    client: {
                        select: { name: true, phone: true }
                    }
                },
                orderBy: { orderDate: 'desc' }
            }),
            prisma.expense.findMany({
                where: { tenantId },
                orderBy: { date: 'desc' }
            }),
            prisma.purchase.findMany({
                where: { tenantId },
                orderBy: { date: 'desc' }
            })
        ]);

        return { tenant, orders, expenses, purchases };
    }

    /**
     * Compute financial metrics for a specific set of orders and expenses
     */
    computePeriodMetrics(orders, expenses, purchases, label = 'Selected Period') {
        // 1. Process Orders (Revenue and COGS)
        let totalRevenue = 0;
        let totalCogs = 0;
        let paidOrderCount = 0;
        let giftSampleOrderCount = 0;
        let giftSampleCostTotal = 0;

        const productTypeMap = {};
        const clientRevenueMap = {};
        const orderDetails = [];

        orders.forEach(order => {
            const meta = order.metadata || {};
            const isGiftOrSample =
                meta.paymentType === 'gift' ||
                meta.paymentType === 'sample' ||
                meta.orderPurpose === 'gift' ||
                meta.orderPurpose === 'sample';

            const rawPrice = Number(meta.salePrice ?? order.totalPrice ?? 0);
            const rawCost = Number(meta.cost ?? order.totalCost ?? 0);
            const salePrice = isGiftOrSample ? 0 : rawPrice;
            const cost = rawCost;

            if (isGiftOrSample) {
                giftSampleOrderCount++;
                giftSampleCostTotal += cost;
            } else {
                paidOrderCount++;
                totalRevenue += salePrice;
            }

            totalCogs += cost;

            const productType = meta.productType || (order.items?.[0]?.name ? 'Cake' : 'Custom');
            if (!productTypeMap[productType]) {
                productTypeMap[productType] = {
                    type: productType,
                    orderCount: 0,
                    revenue: 0,
                    cogs: 0,
                    grossProfit: 0,
                    grossMarginPct: 0
                };
            }

            productTypeMap[productType].orderCount++;
            productTypeMap[productType].revenue += salePrice;
            productTypeMap[productType].cogs += cost;

            const clientName = meta.client || order.client?.name || 'Walk-in Customer';
            clientRevenueMap[clientName] = (clientRevenueMap[clientName] || 0) + salePrice;

            orderDetails.push({
                id: order.id,
                date: getOrderDateKey(order),
                client: clientName,
                productType,
                size: meta.size || order.items?.[0]?.size || '',
                summary: meta.cakeSummary || order.items?.map(i => i.name).join(', ') || 'Custom Order',
                revenue: salePrice,
                cost,
                grossProfit: salePrice - cost,
                grossMarginPct: salePrice > 0 ? round(((salePrice - cost) / salePrice) * 100, 1) : 0,
                isGiftOrSample
            });
        });

        // Compute Product Type Margins
        const productBreakdown = Object.values(productTypeMap).map(pt => {
            const grossProfit = pt.revenue - pt.cogs;
            const grossMarginPct = pt.revenue > 0 ? round((grossProfit / pt.revenue) * 100, 1) : 0;
            return {
                ...pt,
                revenue: round(pt.revenue),
                cogs: round(pt.cogs),
                grossProfit: round(grossProfit),
                grossMarginPct
            };
        }).sort((a, b) => b.grossProfit - a.grossProfit);

        // 2. Process Overhead Expenses
        let totalOverhead = 0;
        const categoryMap = {};

        expenses.forEach(exp => {
            const amt = Number(exp.amount) || 0;
            // Exclude purchases if logged in expenses table to avoid double-counting COGS (P&L rule)
            const isPurchaseSource = exp.category === 'Purchases' ||
                exp.source === 'purchase' ||
                Boolean(exp.purchaseId) ||
                String(exp.description || '').toLowerCase().startsWith('purchase:');

            if (isPurchaseSource) return;

            const cat = exp.category || 'Miscellaneous';
            totalOverhead += amt;
            categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        });

        // Process Purchases
        let totalPurchasesAmount = 0;
        purchases.forEach(p => {
            totalPurchasesAmount += Number(p.amount) || 0;
        });

        const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => {
            const pctOfOverhead = totalOverhead > 0 ? round((amount / totalOverhead) * 100, 1) : 0;
            const pctOfRevenue = totalRevenue > 0 ? round((amount / totalRevenue) * 100, 1) : 0;
            return {
                category,
                amount: round(amount),
                pctOfOverhead,
                pctOfRevenue
            };
        }).sort((a, b) => b.amount - a.amount);

        // 3. Overall Profitability Indicators
        const grossProfit = totalRevenue - totalCogs;
        const grossMarginPct = totalRevenue > 0 ? round((grossProfit / totalRevenue) * 100, 1) : 0;

        const netProfit = grossProfit - totalOverhead;
        const netMarginPct = totalRevenue > 0 ? round((netProfit / totalRevenue) * 100, 1) : 0;

        // 4. Profitability Drain Analysis
        const topExpenseDrains = categoryBreakdown.slice(0, 5);
        const lowMarginOrders = orderDetails
            .filter(o => !o.isGiftOrSample && o.revenue > 0 && o.grossMarginPct < 35)
            .sort((a, b) => a.grossMarginPct - b.grossMarginPct)
            .slice(0, 5);

        return {
            periodLabel: label,
            revenue: round(totalRevenue),
            cogs: round(totalCogs),
            grossProfit: round(grossProfit),
            grossMarginPct,
            totalOverhead: round(totalOverhead),
            netProfit: round(netProfit),
            netMarginPct,
            totalPurchases: round(totalPurchasesAmount),
            paidOrderCount,
            giftSampleOrderCount,
            giftSampleCostTotal: round(giftSampleCostTotal),
            expenseCount: expenses.length,
            productBreakdown,
            categoryBreakdown,
            topExpenseDrains,
            lowMarginOrders,
            topClients: Object.entries(clientRevenueMap)
                .map(([name, total]) => ({ name, total: round(total) }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 5)
        };
    }

    /**
     * Generate complete consolidated financial overview with multi-period & MoM comparisons
     */
    async getConsolidatedFinancialReport(tenantId, targetMonth = null) {
        const { tenant, orders, expenses, purchases } = await this.fetchTenantFinancialRecords(tenantId);

        const now = new Date();
        const currentMonthKey = targetMonth || now.toISOString().slice(0, 7);

        // Compute previous month key
        const [curYear, curMonthNum] = currentMonthKey.split('-').map(Number);
        const prevYear = curMonthNum === 1 ? curYear - 1 : curYear;
        const prevMonthNum = curMonthNum === 1 ? 12 : curMonthNum - 1;
        const prevMonthKey = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

        // Filter confirmed orders
        const confirmedOrders = orders.filter(isConfirmedOrder);

        // 1. Current Month Datasets
        const currentMonthOrders = confirmedOrders.filter(o => isDateInMonth(getOrderDateKey(o), currentMonthKey));
        const currentMonthExpenses = expenses.filter(e => isDateInMonth(e.date, currentMonthKey));
        const currentMonthPurchases = purchases.filter(p => isDateInMonth(p.date, currentMonthKey));

        // 2. Previous Month Datasets
        const prevMonthOrders = confirmedOrders.filter(o => isDateInMonth(getOrderDateKey(o), prevMonthKey));
        const prevMonthExpenses = expenses.filter(e => isDateInMonth(e.date, prevMonthKey));
        const prevMonthPurchases = purchases.filter(p => isDateInMonth(p.date, prevMonthKey));

        // 3. Year-To-Date (YTD) Datasets
        const ytdPrefix = `${curYear}-`;
        const ytdOrders = confirmedOrders.filter(o => String(getOrderDateKey(o)).startsWith(ytdPrefix));
        const ytdExpenses = expenses.filter(e => String(e.date?.toISOString ? e.date.toISOString() : e.date).startsWith(ytdPrefix));
        const ytdPurchases = purchases.filter(p => String(p.date?.toISOString ? p.date.toISOString() : p.date).startsWith(ytdPrefix));

        // 4. All-Time Datasets
        const allTimeOrders = confirmedOrders;
        const allTimeExpenses = expenses;
        const allTimePurchases = purchases;

        // Current Month Label
        const monthDate = new Date(`${currentMonthKey}-02`);
        const currentMonthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const prevMonthDate = new Date(`${prevMonthKey}-02`);
        const prevMonthName = prevMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Calculate Metrics for Each Period
        const currentMonth = this.computePeriodMetrics(currentMonthOrders, currentMonthExpenses, currentMonthPurchases, currentMonthName);
        const previousMonth = this.computePeriodMetrics(prevMonthOrders, prevMonthExpenses, prevMonthPurchases, prevMonthName);
        const ytd = this.computePeriodMetrics(ytdOrders, ytdExpenses, ytdPurchases, `Year to Date (${curYear})`);
        const allTime = this.computePeriodMetrics(allTimeOrders, allTimeExpenses, allTimePurchases, 'All-Time');

        // Month-over-Month (MoM) Comparisons
        const revDiff = currentMonth.revenue - previousMonth.revenue;
        const revDiffPct = previousMonth.revenue > 0 ? round((revDiff / previousMonth.revenue) * 100, 1) : (currentMonth.revenue > 0 ? 100 : 0);

        const profitDiff = currentMonth.netProfit - previousMonth.netProfit;
        const profitDiffPct = previousMonth.netProfit !== 0 ? round((profitDiff / Math.abs(previousMonth.netProfit)) * 100, 1) : 0;

        const overheadDiff = currentMonth.totalOverhead - previousMonth.totalOverhead;
        const overheadDiffPct = previousMonth.totalOverhead > 0 ? round((overheadDiff / previousMonth.totalOverhead) * 100, 1) : 0;

        const grossMarginDiff = round(currentMonth.grossMarginPct - previousMonth.grossMarginPct, 1);
        const netMarginDiff = round(currentMonth.netMarginPct - previousMonth.netMarginPct, 1);

        const momComparison = {
            currentMonthKey,
            prevMonthKey,
            revenue: {
                current: currentMonth.revenue,
                previous: previousMonth.revenue,
                difference: round(revDiff),
                percentageChange: revDiffPct
            },
            netProfit: {
                current: currentMonth.netProfit,
                previous: previousMonth.netProfit,
                difference: round(profitDiff),
                percentageChange: profitDiffPct
            },
            overhead: {
                current: currentMonth.totalOverhead,
                previous: previousMonth.totalOverhead,
                difference: round(overheadDiff),
                percentageChange: overheadDiffPct
            },
            grossMargin: {
                current: currentMonth.grossMarginPct,
                previous: previousMonth.grossMarginPct,
                diffPoints: grossMarginDiff
            },
            netMargin: {
                current: currentMonth.netMarginPct,
                previous: previousMonth.netMarginPct,
                diffPoints: netMarginDiff
            }
        };

        // Monthly trends for last 6 months
        const monthlyTrends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(curYear, curMonthNum - 1 - i, 1);
            const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const mName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            const mOrders = confirmedOrders.filter(o => isDateInMonth(getOrderDateKey(o), mKey));
            const mExp = expenses.filter(e => isDateInMonth(e.date, mKey));
            const mPur = purchases.filter(p => isDateInMonth(p.date, mKey));

            const mMetrics = this.computePeriodMetrics(mOrders, mExp, mPur, mName);
            monthlyTrends.push({
                monthKey: mKey,
                monthName: mName,
                revenue: mMetrics.revenue,
                cogs: mMetrics.cogs,
                grossProfit: mMetrics.grossProfit,
                overhead: mMetrics.totalOverhead,
                netProfit: mMetrics.netProfit,
                grossMarginPct: mMetrics.grossMarginPct,
                netMarginPct: mMetrics.netMarginPct,
                orders: mMetrics.paidOrderCount
            });
        }

        return {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                currency: 'NGN (₦)'
            },
            currentMonthKey,
            currentMonth,
            previousMonth,
            momComparison,
            ytd,
            allTime,
            monthlyTrends,
            auditTrace: {
                tenantId,
                totalConfirmedOrdersDatabase: confirmedOrders.length,
                totalExpensesDatabase: expenses.length,
                totalPurchasesDatabase: purchases.length,
                activeReportingMonth: currentMonthKey,
                generatedAt: new Date().toISOString()
            }
        };
    }
}

module.exports = new FinancialAnalyticsService();
