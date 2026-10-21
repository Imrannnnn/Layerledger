/**
 * ----------------------------------------------------------------------
 * Financial Assistant Service
 * ----------------------------------------------------------------------
 * Conversational AI engine for BakeWealth financial intelligence.
 * Translates natural language inquiries into data-driven insights using
 * verified tenant records.
 *
 * Implements a Dual-Engine architecture:
 * - Engine 1: Claude LLM with grounded system context for natural dialogue
 * - Engine 2: Deterministic Financial Intelligence Engine as immediate,
 *             mathematically guaranteed fallback if external AI is offline.
 * ----------------------------------------------------------------------
 */

const financialAnalyticsService = require('./financialAnalyticsService');

/**
 * Format currency in Nigerian Naira (₦)
 */
const fmtMoney = (amount) => {
    const val = Number(amount) || 0;
    return `₦${Math.round(val).toLocaleString('en-NG')}`;
};

/**
 * Detect temporal scope from user inquiry
 */
const detectTemporalScope = (text = '') => {
    const q = text.toLowerCase().trim();
    if (
        q.includes('this year') ||
        q.includes('totally spent this year') ||
        q.includes('total spent this year') ||
        q.includes('total this year') ||
        q.includes('spent this year') ||
        q.includes('earned this year') ||
        q.includes('revenue this year') ||
        q.includes('sales this year') ||
        q.includes('ytd') ||
        q.includes('year to date') ||
        q.includes('annual') ||
        q.includes('in 2026') ||
        q.includes('for 2026') ||
        q.includes('entire year') ||
        q.includes('whole year')
    ) {
        return 'YTD';
    }
    if (
        q.includes('all time') ||
        q.includes('all-time') ||
        q.includes('ever') ||
        q.includes('since beginning') ||
        q.includes('since inception') ||
        q.includes('overall') ||
        q.includes('historically') ||
        q.includes('in total overall')
    ) {
        return 'ALL_TIME';
    }
    if (
        q.includes('last month') ||
        q.includes('previous month') ||
        q.includes('prior month') ||
        q.includes('september')
    ) {
        return 'PREVIOUS_MONTH';
    }
    return 'CURRENT_MONTH';
};

/**
 * Detect question intent for deterministic intelligence engine
 */
const detectIntent = (text = '') => {
    const q = text.toLowerCase().trim();

    // Check for combined Earnings & Profit Margin or Full Margin Analysis
    const hasEarnings = q.includes('earned') || q.includes('revenue') || q.includes('how much') || q.includes('sales') || q.includes('income') || q.includes('made');
    const hasMargin = q.includes('margin') || q.includes('profit') || q.includes('cogs');
    const isExplicitCombined = (hasEarnings && hasMargin) || q.includes('full margin') || q.includes('complete estimate') || q.includes('margin analysis') || q.includes('complete analysis');

    if (isExplicitCombined) {
        return 'COMPLETE_MARGIN_ANALYSIS';
    }

    if (q.includes('earned') || q.includes('revenue') || q.includes('how much have i made') || q.includes('sales') || q.includes('income')) {
        return 'REVENUE_EARNINGS';
    }
    if (q.includes('margin') || q.includes('profit margin') || q.includes('gross profit') || q.includes('net profit')) {
        return 'PROFIT_MARGIN';
    }
    if (q.includes('spent') || q.includes('spend') || q.includes('expense') || q.includes('on what') || q.includes('where is my money going')) {
        return 'EXPENSES_BREAKDOWN';
    }
    if (q.includes('product') || q.includes('service') || q.includes('most profit') || q.includes('best seller') || q.includes('generate the most')) {
        return 'TOP_PRODUCTS';
    }
    if (q.includes('compare') || q.includes('previous month') || q.includes('last month') || q.includes('performance') || q.includes('this month vs')) {
        return 'MOM_COMPARISON';
    }
    if (q.includes('reducing') || q.includes('drain') || q.includes('loss') || q.includes('costing me') || q.includes('unprofitable') || q.includes('areas reducing')) {
        return 'PROFITABILITY_DRAINS';
    }
    if (q.includes('overview') || q.includes('summary') || q.includes('report') || q.includes('health') || q.includes('how is my business')) {
        return 'CONSOLIDATED_OVERVIEW';
    }

    return 'GENERAL_FINANCIAL';
};

/**
 * Construct deterministic natural language financial response (Strictly Zero Emojis)
 */
const generateDeterministicAnswer = (intent, report, userQuestion = '') => {
    const { currentMonth, previousMonth, momComparison, ytd, allTime, tenant } = report;
    const businessName = tenant.name || 'Your Bakery';
    const temporalScope = detectTemporalScope(userQuestion);

    // Select the active period dataset based on temporal intent
    let activePeriod = currentMonth;
    if (temporalScope === 'YTD') {
        activePeriod = ytd;
    } else if (temporalScope === 'ALL_TIME') {
        activePeriod = allTime;
    } else if (temporalScope === 'PREVIOUS_MONTH') {
        activePeriod = previousMonth;
    }

    const periodName = activePeriod.periodLabel;

    switch (intent) {
        case 'COMPLETE_MARGIN_ANALYSIS': {
            const avgOrder = activePeriod.paidOrderCount > 0
                ? fmtMoney(activePeriod.revenue / activePeriod.paidOrderCount)
                : fmtMoney(0);
            const isProfitable = activePeriod.netProfit >= 0;

            return `### Complete Financial Estimate & Full Margin Analysis for ${businessName}

**Reporting Horizon: ${periodName}**

Here is your consolidated financial estimate and complete margin analysis, audited directly from verified database records:

#### 1. Total Earnings & Revenue Estimate
- **Sales Revenue (${periodName}):** **${fmtMoney(activePeriod.revenue)}** across **${activePeriod.paidOrderCount}** confirmed paid orders.
- **Average Order Value (AOV):** **${avgOrder}** per order.
- **Year-To-Date (YTD) Revenue:** **${fmtMoney(ytd.revenue)}** (${ytd.paidOrderCount} orders).
- **All-Time Confirmed Revenue:** **${fmtMoney(allTime.revenue)}** across **${allTime.paidOrderCount}** confirmed orders.

#### 2. Step-by-Step Profit Margin Breakdown
1. **Gross Sales Revenue:** **${fmtMoney(activePeriod.revenue)}** (100.0%)
2. **Cost of Goods Sold (COGS - Ingredients & Direct Production):** **-${fmtMoney(activePeriod.cogs)}**
3. **Gross Profit:** **${fmtMoney(activePeriod.grossProfit)}**
   - **Gross Profit Margin:** **${activePeriod.grossMarginPct}%**
   *(Gross margin measures markup above direct ingredient production costs)*
4. **Operating Overhead Expenses (Rent, Utilities, Packaging, Logistics):** **-${fmtMoney(activePeriod.totalOverhead)}**
5. **Net Profit (Bottom Line Take-Home):** **${fmtMoney(activePeriod.netProfit)}**
   - **Net Profit Margin:** **${activePeriod.netMarginPct}%**

#### 3. Profit Margin Assessment & Benchmarks
- **Gross Margin (${activePeriod.grossMarginPct}%):** ${activePeriod.grossMarginPct >= 50 ? '**[Optimal]** Healthy recipe markups leaving strong margin for overhead coverage.' : activePeriod.grossMarginPct >= 35 ? '**[Standard]** Sound commercial gross margin for bakery production.' : '**[Review Required]** Below 35% target threshold. Review ingredient costs and tier pricing.'}
- **Net Margin (${activePeriod.netMarginPct}%):** ${isProfitable ? `**[Profitable]** Retaining **${activePeriod.netMarginPct}%** as net profit after all operating overheads.` : `**[Negative Margin]** Operating overheads (${fmtMoney(activePeriod.totalOverhead)}) exceeded gross profit (${fmtMoney(activePeriod.grossProfit)}). Focus on top overhead expense categories.`}

#### 4. Top Product Margin Contributors
${activePeriod.productBreakdown.slice(0, 3).map(p => `- **${p.type}:** Revenue ${fmtMoney(p.revenue)} | Gross Profit **${fmtMoney(p.grossProfit)}** (${p.grossMarginPct}% margin, ${p.orderCount} orders)`).join('\n') || '- No product breakdown recorded for this period.'}

> **Audit Trace:** 100% database grounded. Analyzed ${activePeriod.paidOrderCount} paid orders, ${activePeriod.giftSampleOrderCount} sample orders (${fmtMoney(activePeriod.giftSampleCostTotal)} cost), and ${activePeriod.expenseCount} overhead expenses. Zero simulated figures.`;
        }

        case 'REVENUE_EARNINGS': {
            const avgOrder = activePeriod.paidOrderCount > 0
                ? fmtMoney(activePeriod.revenue / activePeriod.paidOrderCount)
                : fmtMoney(0);

            return `### Revenue & Earnings Analysis for ${businessName}

**Reporting Horizon: ${periodName}**

- **Total Revenue (${periodName}):** **${fmtMoney(activePeriod.revenue)}** across **${activePeriod.paidOrderCount}** confirmed paid orders.
- **Average Order Value (AOV):** **${avgOrder}** per order.
- **Year-To-Date (YTD) Revenue:** **${fmtMoney(ytd.revenue)}** (${ytd.paidOrderCount} orders).
- **All-Time Revenue:** **${fmtMoney(allTime.revenue)}** across **${allTime.paidOrderCount}** confirmed orders.

**Top Revenue Generating Product Types (${periodName}):**
${activePeriod.productBreakdown.slice(0, 3).map(p => `- **${p.type}:** ${fmtMoney(p.revenue)} (${p.orderCount} orders, gross margin: ${p.grossMarginPct}%)`).join('\n') || '- No product breakdown available for this period.'}

> **Audit Trace:** Figures calculated from confirmed orders in ${periodName}. Excludes complimentary gift and promotional sample orders from sales revenue.`;
        }

        case 'PROFIT_MARGIN': {
            const isProfitable = activePeriod.netProfit >= 0;
            return `### Profit Margin Breakdown for ${businessName}

**Reporting Horizon: ${periodName}**

Here is the step-by-step breakdown of your operational and net profitability:

1. **Total Sales Revenue:** **${fmtMoney(activePeriod.revenue)}**
2. **Cost of Goods Sold (COGS - Ingredients & Production):** **-${fmtMoney(activePeriod.cogs)}**
3. **Gross Profit:** **${fmtMoney(activePeriod.grossProfit)}**
   - **Gross Profit Margin:** **${activePeriod.grossMarginPct}%**
   *(Gross margin reflects recipe markup over ingredient and production costs)*
4. **Overhead Operating Expenses:** **-${fmtMoney(activePeriod.totalOverhead)}**
5. **Net Profit:** **${fmtMoney(activePeriod.netProfit)}**
   - **Net Profit Margin:** **${activePeriod.netMarginPct}%**

**Benchmark & Assessment:**
${isProfitable
    ? `Your net profit margin is **${activePeriod.netMarginPct}%**, which is positive. A benchmark boutique bakery typically targets 20% to 35% net margin.`
    : `Your net margin is currently negative (**${activePeriod.netMarginPct}%**), meaning overhead expenses (${fmtMoney(activePeriod.totalOverhead)}) exceeded gross profit (${fmtMoney(activePeriod.grossProfit)}). Focus on top overhead categories and reviewing recipe markups.`}

> **Calculation Formula:** Gross Margin = (Gross Profit / Revenue) × 100. Net Margin = (Net Profit / Revenue) × 100.`;
        }

        case 'EXPENSES_BREAKDOWN': {
            const hasCategories = activePeriod.categoryBreakdown.length > 0;
            const isCurrentAndEmpty = temporalScope === 'CURRENT_MONTH' && activePeriod.totalOverhead === 0 && ytd.totalOverhead > 0;

            return `### Expenditure & Expenses Breakdown for ${businessName}

**Reporting Horizon: ${periodName}**

- **Total Overhead Operating Expenses:** **${fmtMoney(activePeriod.totalOverhead)}** (logged across ${activePeriod.expenseCount} entries)
- **Ingredient Purchases Logged:** **${fmtMoney(activePeriod.totalPurchases)}**
- **Promotional / Gift Sample Costs:** **${fmtMoney(activePeriod.giftSampleCostTotal)}**

**Category Breakdown (Ranked by Expenditure):**
${hasCategories
    ? activePeriod.categoryBreakdown.map(c => `- **${c.category}:** **${fmtMoney(c.amount)}** (${c.pctOfOverhead}% of overheads, ${c.pctOfRevenue}% of revenue)`).join('\n')
    : `- No overhead expenses recorded for ${periodName}.`}

${activePeriod.topExpenseDrains.length > 0
    ? `> **Primary Expenditure Driver:** Your largest cost category is **${activePeriod.topExpenseDrains[0].category}** at **${fmtMoney(activePeriod.topExpenseDrains[0].amount)}**, representing **${activePeriod.topExpenseDrains[0].pctOfOverhead}%** of all overhead spending.`
    : ''}
${isCurrentAndEmpty
    ? `\n> **Year-To-Date Reference:** For the complete year (${ytd.periodLabel}), your total overhead spending is **${fmtMoney(ytd.totalOverhead)}** across ${ytd.expenseCount} entries, led by **${ytd.topExpenseDrains[0]?.category || 'Ingredients / Supplies'}** (${fmtMoney(ytd.topExpenseDrains[0]?.amount || 0)}).`
    : ''}`;
        }

        case 'TOP_PRODUCTS': {
            const topProducts = activePeriod.productBreakdown;
            if (topProducts.length === 0) {
                return `### Product Profitability Analysis for ${businessName}

**Reporting Horizon: ${periodName}**

No confirmed product orders were found for ${periodName}. Looking at your **All-Time** records:

${allTime.productBreakdown.slice(0, 5).map((p, idx) => `${idx + 1}. **${p.type}:** Revenue ${fmtMoney(p.revenue)} | Gross Profit **${fmtMoney(p.grossProfit)}** (Margin: **${p.grossMarginPct}%**, ${p.orderCount} orders)`).join('\n')}

> **Insight:** Your highest gross profit generator is **${allTime.productBreakdown[0]?.type || 'Cake'}** with **${fmtMoney(allTime.productBreakdown[0]?.grossProfit || 0)}** total profit generated.`;
            }

            const highestProfit = topProducts[0];
            const highestMargin = [...topProducts].sort((a, b) => b.grossMarginPct - a.grossMarginPct)[0];

            return `### Product & Service Profitability Analysis for ${businessName}

**Reporting Horizon: ${periodName}**

**Ranked by Total Gross Profit Generated:**
${topProducts.map((p, idx) => `${idx + 1}. **${p.type}**
   - **Gross Profit:** **${fmtMoney(p.grossProfit)}** (Gross Margin: **${p.grossMarginPct}%**)
   - **Revenue:** ${fmtMoney(p.revenue)} from ${p.orderCount} order${p.orderCount !== 1 ? 's' : ''}
   - **Ingredient Cost:** ${fmtMoney(p.cogs)}`).join('\n\n')}

**Strategic Takeaways:**
- **Top Earner:** **${highestProfit.type}** generated the highest total profit (**${fmtMoney(highestProfit.grossProfit)}**).
- **Highest Margin:** **${highestMargin.type}** carries your best profit efficiency at **${highestMargin.grossMarginPct}%** margin.

> **Recommendation:** Promote your high-margin items to boost overall net profitability without proportionately increasing production hours.`;
        }

        case 'MOM_COMPARISON': {
            const { revenue, netProfit, overhead, grossMargin, netMargin } = momComparison;

            return `### Month-over-Month Performance Comparison

**Comparing: ${currentMonth.periodLabel} vs ${previousMonth.periodLabel}**

| Financial Indicator | ${previousMonth.periodLabel} | ${currentMonth.periodLabel} | Change (₦) | Change (%) |
| :--- | :--- | :--- | :--- | :--- |
| **Sales Revenue** | ${fmtMoney(revenue.previous)} | ${fmtMoney(revenue.current)} | ${revenue.difference >= 0 ? '+' : ''}${fmtMoney(revenue.difference)} | ${revenue.percentageChange >= 0 ? '+' : ''}${revenue.percentageChange}% |
| **Overhead Expenses** | ${fmtMoney(overhead.previous)} | ${fmtMoney(overhead.current)} | ${overhead.difference >= 0 ? '+' : ''}${fmtMoney(overhead.difference)} | ${overhead.percentageChange >= 0 ? '+' : ''}${overhead.percentageChange}% |
| **Net Profit / (Loss)** | ${fmtMoney(netProfit.previous)} | ${fmtMoney(netProfit.current)} | ${netProfit.difference >= 0 ? '+' : ''}${fmtMoney(netProfit.difference)} | ${netProfit.percentageChange >= 0 ? '+' : ''}${netProfit.percentageChange}% |
| **Gross Margin %** | ${grossMargin.previous}% | ${grossMargin.current}% | ${grossMargin.diffPoints >= 0 ? '+' : ''}${grossMargin.diffPoints} pts | — |
| **Net Margin %** | ${netMargin.previous}% | ${netMargin.current}% | ${netMargin.diffPoints >= 0 ? '+' : ''}${netMargin.diffPoints} pts | — |

**Summary Evaluation:**
- **Revenue Trajectory:** Revenue ${revenue.difference >= 0 ? `increased by ${fmtMoney(revenue.difference)} (+${revenue.percentageChange}%)` : `decreased by ${fmtMoney(Math.abs(revenue.difference))} (${revenue.percentageChange}%)`}.
- **Net Earnings:** Net profit ${netProfit.difference >= 0 ? `improved by ${fmtMoney(netProfit.difference)}` : `declined by ${fmtMoney(Math.abs(netProfit.difference))}`}.
- **Operational Cost Shift:** Operating expenses ${overhead.difference >= 0 ? `grew by ${fmtMoney(overhead.difference)}` : `reduced by ${fmtMoney(Math.abs(overhead.difference))}`}.`;
        }

        case 'PROFITABILITY_DRAINS': {
            const activeDrains = temporalScope === 'YTD' ? ytd : currentMonth;
            const topDrains = activeDrains.topExpenseDrains;
            const lowMargins = activeDrains.lowMarginOrders;

            return `### Operational & Margin Risk Assessment for ${businessName}

**Reporting Horizon: ${activeDrains.periodLabel}**

Based on verified database records for ${activeDrains.periodLabel}, here are the primary drains on your profit margins:

#### 1. Top Overhead Expense Drains
${topDrains.length > 0
    ? topDrains.map((c, i) => `${i + 1}. **${c.category}:** **${fmtMoney(c.amount)}** — absorbs **${c.pctOfOverhead}%** of all overheads (${c.pctOfRevenue}% of total revenue).`).join('\n')
    : `- No overhead expense records found for ${activeDrains.periodLabel}.`}

#### 2. Promotional & Complimentary Orders
- Logged **${activeDrains.giftSampleOrderCount}** complimentary gift/sample order(s) for this period, absorbing **${fmtMoney(activeDrains.giftSampleCostTotal)}** in ingredients with ₦0 sales revenue.

#### 3. Low-Margin or Under-Priced Orders
${lowMargins.length > 0
    ? lowMargins.map((o, i) => `${i + 1}. **${o.summary}** for *${o.client}* (${o.date || 'Recent'}):
   - Sale Price: ${fmtMoney(o.revenue)} | Cost: ${fmtMoney(o.cost)} | Margin: **${o.grossMarginPct}%** *(Below recommended 40%+ threshold)*`).join('\n')
    : '- All confirmed orders met or exceeded the 35% gross margin threshold.'}

> **Strategic Recommendations:**
> 1. Target the **${topDrains[0]?.category || 'primary expense'}** category for negotiated vendor terms or bulk purchasing.
> 2. Ensure all custom cake tiers carry at least a 40% markup above ingredient and accessory costs.
> 3. Limit complimentary samples or incorporate sample costs into marketing budgets.`;
        }

        case 'CONSOLIDATED_OVERVIEW':
        default: {
            return `### Executive Financial Intelligence Report for ${businessName}

**Reporting Horizon: ${periodName}**

Here is your unified executive financial performance summary:

- **Total Revenue:** **${fmtMoney(activePeriod.revenue)}** (${activePeriod.paidOrderCount} confirmed orders)
- **Production Cost of Goods (COGS):** **${fmtMoney(activePeriod.cogs)}**
- **Gross Profit:** **${fmtMoney(activePeriod.grossProfit)}** (Gross Margin: **${activePeriod.grossMarginPct}%**)
- **Overhead Operating Expenses:** **${fmtMoney(activePeriod.totalOverhead)}**
- **Net Profit:** **${fmtMoney(activePeriod.netProfit)}** (Net Margin: **${activePeriod.netMarginPct}%**)
- **Year-To-Date (YTD) Revenue:** **${fmtMoney(ytd.revenue)}** (Net Profit: **${fmtMoney(ytd.netProfit)}**)

**Operational Status:**
- Business operates at a **${activePeriod.netMarginPct}%** net profit margin for this period.
- Largest revenue driver: **${activePeriod.productBreakdown[0]?.type || 'Cake'}** (${fmtMoney(activePeriod.productBreakdown[0]?.revenue || 0)}).
- Largest expense category: **${activePeriod.topExpenseDrains[0]?.category || 'None'}** (${fmtMoney(activePeriod.topExpenseDrains[0]?.amount || 0)}).

*Inquire on any specific metric including revenues, ingredient margins, overhead categories, or comparative periods.*`;
        }
    }
};

class FinancialAssistantService {
    /**
     * Answer a financial question for a tenant with strict isolation and grounded accuracy
     */
    async answerFinancialQuery({ tenantId, question, conversationHistory = [], targetMonth = null }) {
        if (!tenantId) {
            throw new Error('Tenant ID is required for financial analysis.');
        }

        // 1. Fetch complete, isolated financial report
        const report = await financialAnalyticsService.getConsolidatedFinancialReport(tenantId, targetMonth);
        const intent = detectIntent(question);

        // 2. Prepare AI System Prompt containing ground truth data
        const groundTruthContext = {
            reportingPeriod: report.currentMonth.periodLabel,
            currency: report.tenant.currency,
            currentMonth: report.currentMonth,
            previousMonth: report.previousMonth,
            momComparison: report.momComparison,
            ytd: report.ytd,
            allTime: report.allTime,
            auditTrace: report.auditTrace
        };

        const systemPrompt = `You are BakeWealth's Executive Financial Intelligence Advisor, an elite, data-driven analytical system embedded in the BakeWealth platform.
You deliver rigorous, objective, and deeply insightful financial reporting directly from the verified database records of "${report.tenant.name}".

CRITICAL BEHAVIORAL & FORMATTING DIRECTIVES:

1. ABSOLUTE ZERO-EMOJI DIRECTIVE:
   - Under NO CIRCUMSTANCES should you output any emojis, icons, pictorial glyphs, or decorative symbols (such as 💰, 📊, 💎, 🟢, 🟡, 🔴, ⚠️, 🍰, 💸, 📈, 📉, 💡, 🔄, 🏆, etc.).
   - The tone must be strictly professional, executive, sophisticated, and polished (comparable to a senior CFO report or a top-tier corporate finance advisory memorandum).
   - Use clean, structured GitHub markdown: bold section titles, clean bullet points (-), formatted financial tables, and crisp indentation.

2. DYNAMIC TEMPORAL UNDERSTANDING & SCOPE PRECISION:
   Analyze the user's inquiry to determine their exact temporal horizon:
   a) Year-To-Date (YTD) / Annual:
      - Trigger keywords: "this year", "totally spent this year", "total spent this year", "annual", "YTD", "year to date", "in 2026", "calendar year", "the whole year", "entire year".
      - You MUST answer specifically and comprehensively using the "ytd" dataset.
      - State clearly at the top: "**Reporting Horizon: Year-To-Date (2026)**".
      - Present total YTD overhead expenses, ingredient purchases, and full category breakdowns for the year.
   b) Specific / Current Month:
      - When the user asks about the current period or doesn't specify a timeframe (e.g., "How much have I spent?", "What are my margins?"):
      - Focus on the active current month (${report.currentMonth.periodLabel}).
      - State clearly at the top: "**Reporting Horizon: Current Month (${report.currentMonth.periodLabel})**".
      - If the current month has ₦0 or few entries, report the current month figures accurately, and immediately provide the Year-To-Date (YTD) figures as complementary context so the user receives complete intelligence.
   c) Previous Month / Comparisons:
      - Trigger keywords: "last month", "previous month", "compared to last month", "september".
      - Use the "previousMonth" and "momComparison" datasets.
      - State clearly at the top: "**Reporting Horizon: Previous Month vs Current Month**".
   d) All-Time:
      - Trigger keywords: "all time", "ever", "since start", "since inception", "historical total".
      - Use the "allTime" dataset.
      - State clearly at the top: "**Reporting Horizon: All-Time Cumulative**".

3. ACCURACY & MATHEMATICAL GROUNDING:
   - Ground all figures 100% in the verified financial data provided below. Never fabricate, hallucinate, or assume missing numbers.
   - Always format currency values with the Nigerian Naira sign (₦) and standard thousand commas (e.g., ₦1,571,885).
   - Core Financial Definitions:
     - Gross Profit = Sales Revenue - Cost of Goods Sold (Ingredients & Direct Production)
     - Gross Margin = (Gross Profit / Sales Revenue) * 100
     - Overhead Expenses = Operating costs (utilities, rent, delivery, packaging, maintenance, etc. excluding ingredient purchases to avoid double-counting COGS)
     - Net Profit = Gross Profit - Overhead Expenses
     - Net Margin = (Net Profit / Sales Revenue) * 100

4. COMPREHENSIVE DRILL-DOWN ON EXPENDITURES:
   - When asked "How much have I spent, and on what?" (or any expense inquiry), provide:
     1. Total Operating Overhead Expenses.
     2. Ingredient Purchases logged.
     3. An exhaustive, ranked breakdown of every expense category with exact amounts, share of overheads (%), and share of revenue (%).
     4. Clear analytical observations highlighting the primary cost drivers and strategic recommendations for cost control.

5. CONSOLIDATED ALL-IN-ONE DELIVERY:
   - When users inquire about earnings, profit margins, or full margin analysis, give them a complete, end-to-end breakdown in a single cohesive briefing without requiring them to consult multiple dashboards.

VERIFIED BUSINESS FINANCIAL DATA:
${JSON.stringify(groundTruthContext, null, 2)}`;

        // 3. Attempt Engine 1 (Anthropic Claude API via server key)
        const apiKey = process.env.CLAUDE_API || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
        let aiResponseText = null;
        let engineUsed = 'financial_analytics_engine';

        if (apiKey) {
            try {
                const messagesPayload = [];
                if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
                    conversationHistory.slice(-4).forEach(msg => {
                        if (msg.role === 'user' || msg.role === 'assistant') {
                            messagesPayload.push({
                                role: msg.role,
                                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
                            });
                        }
                    });
                }
                messagesPayload.push({
                    role: 'user',
                    content: question
                });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for thorough AI synthesis

                const model = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: model,
                        max_tokens: 2500,
                        system: systemPrompt,
                        messages: messagesPayload
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const textBlock = data?.content?.find(b => b.type === 'text');
                    if (textBlock?.text) {
                        aiResponseText = textBlock.text;
                        engineUsed = 'claude';
                    }
                }
            } catch (claudeErr) {
                // Non-fatal, gracefully fall back to Engine 2
                console.warn('[FinancialAssistant] Claude API call notice (falling back to analytics engine):', claudeErr.message);
            }
        }

        // 4. Fallback to Engine 2 (Deterministic Financial Analytics Engine)
        if (!aiResponseText) {
            aiResponseText = generateDeterministicAnswer(intent, report, question);
            engineUsed = 'financial_analytics_engine';
        }

        // 5. Generate Dynamic Suggested Next Questions
        const suggestedQuestions = [
            'What is my current profit margin?',
            'How much have I spent, and on what?',
            'Which products generate the most profit?',
            'How does this month compare with last month?',
            'What areas are reducing my profitability?'
        ].filter(q => q.toLowerCase() !== question.toLowerCase()).slice(0, 3);

        return {
            answer: aiResponseText,
            intent,
            engineUsed,
            metrics: {
                period: report.currentMonth.periodLabel,
                revenue: report.currentMonth.revenue,
                cogs: report.currentMonth.cogs,
                grossProfit: report.currentMonth.grossProfit,
                grossMarginPct: report.currentMonth.grossMarginPct,
                totalOverhead: report.currentMonth.totalOverhead,
                netProfit: report.currentMonth.netProfit,
                netMarginPct: report.currentMonth.netMarginPct,
                orderCount: report.currentMonth.paidOrderCount
            },
            auditTrace: {
                tenantId,
                reportingPeriod: report.currentMonth.periodLabel,
                ordersAnalyzed: report.currentMonth.paidOrderCount + report.currentMonth.giftSampleOrderCount,
                expensesAnalyzed: report.currentMonth.expenseCount,
                calculatedAt: new Date().toISOString()
            },
            suggestedQuestions
        };
    }
}

module.exports = new FinancialAssistantService();
