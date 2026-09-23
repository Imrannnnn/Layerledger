/**
 * ----------------------------------------------------------------------
 * Bakewealth Subscription & Quota Watcher
 * ----------------------------------------------------------------------
 * Monitors:
 * 1. Prepaid subscription expirations (alerts owners 3 days prior or on expiration)
 * 2. AI scan credit depletion (alerts owners when balance falls to <= 4 credits / 2 scans)
 * ----------------------------------------------------------------------
 */

const prisma = require('../prisma');
const emailService = require('./emailService');
const { getEffectivePlan } = require('../controller/planController');

class SubscriptionWatcher {
    /**
     * Inspect all active tenants and send expiry warnings if within threshold (default 3 days)
     */
    async checkExpiringSubscriptions(thresholdDays = 3) {
        try {
            const tenants = await prisma.tenant.findMany({
                include: {
                    users: {
                        where: { role: 'owner' },
                        select: { name: true, email: true }
                    }
                }
            });

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            let checkedCount = 0;
            let alertedCount = 0;

            for (const tenant of tenants) {
                const settings = tenant.settings || {};
                const effective = getEffectivePlan(tenant);

                // Only paid plans can expire
                if (effective.rawPlan !== 'standard' && effective.rawPlan !== 'premium') {
                    continue;
                }

                checkedCount++;
                const daysRemaining = effective.daysRemaining;

                // Check if plan is expiring within threshold and not yet alerted today
                if (daysRemaining !== null && daysRemaining <= thresholdDays && daysRemaining >= 0) {
                    if (settings.lastExpiryWarningDate === todayStr) {
                        continue; // Already notified today
                    }

                    const owner = tenant.users[0];
                    if (!owner || !owner.email) continue;

                    await emailService.sendSubscriptionExpiringEmail({
                        to: owner.email,
                        name: owner.name,
                        companyName: tenant.name,
                        planName: effective.rawPlan,
                        daysRemaining,
                        expiresAt: effective.planExpiresAt,
                        renewalUrl: `${process.env.APP_URL || 'http://localhost:5173'}/settings?tab=subscription`
                    });

                    // Update settings to remember warning was sent
                    await prisma.tenant.update({
                        where: { id: tenant.id },
                        data: {
                            settings: {
                                ...settings,
                                lastExpiryWarningDate: todayStr
                            }
                        }
                    });

                    alertedCount++;
                    console.log(`[SubscriptionWatcher] Sent expiry notice to ${owner.email} (${tenant.name}: ${daysRemaining} days left)`);
                }
            }

            return { checkedCount, alertedCount };
        } catch (error) {
            console.error('[SubscriptionWatcher] Error checking expiring subscriptions:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Check if a specific tenant has low tokens and send an alert if not recently notified
     * @param {string} tenantId
     * @param {number} currentBalance
     */
    async checkAndNotifyLowTokens(tenantId, currentBalance) {
        try {
            if (currentBalance > 4) return; // Sufficient credits (> 2 scans)

            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: {
                    users: {
                        where: { role: 'owner' },
                        select: { name: true, email: true }
                    }
                }
            });

            if (!tenant) return;
            const settings = tenant.settings || {};

            // Avoid sending repeated emails for the same low-credit state
            if (settings.lastLowTokenAlertSent && settings.lastLowTokenAlertBalance === currentBalance) {
                return;
            }

            const owner = tenant.users[0];
            if (!owner || !owner.email) return;

            const scansRemaining = Math.max(0, Math.floor(currentBalance / 2));

            await emailService.sendTokenLowEmail({
                to: owner.email,
                name: owner.name,
                companyName: tenant.name,
                tokenBalance: currentBalance,
                scansRemaining,
                topUpUrl: `${process.env.APP_URL || 'http://localhost:5173'}/tokens`
            });

            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    settings: {
                        ...settings,
                        lastLowTokenAlertSent: true,
                        lastLowTokenAlertBalance: currentBalance,
                        lastLowTokenAlertAt: new Date().toISOString()
                    }
                }
            });

            console.log(`[SubscriptionWatcher] Sent low token alert to ${owner.email} (balance: ${currentBalance}, scans: ${scansRemaining})`);
        } catch (error) {
            console.error('[SubscriptionWatcher] Error checking low tokens:', error.message);
        }
    }
}

module.exports = new SubscriptionWatcher();
