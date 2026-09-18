/**
 * LayerLedger Payment Background Worker Jobs
 * Adheres to Principles:
 * #24 (Async Work Offloading), #25 (Background Jobs),
 * #26 (Retry Background Jobs), #27 (Dead-Letter Queue)
 */

const paymentRepository = require('../modules/payments/payment.repository');

class PaymentJobRunner {
    constructor(repository = paymentRepository) {
        this.repository = repository;
        this.handlers = {
            PAYMENT_RECEIPT: this.handlePaymentReceipt.bind(this),
            LEDGER_SYNC: this.handleLedgerSync.bind(this)
        };
    }

    async handlePaymentReceipt(payload) {
        // Idempotent email / notification sender
        console.log(`[Job Worker] Generating payment receipt for ${payload.customerEmail} (${payload.paymentReference}: ${payload.amount} ${payload.currency})`);
        return true;
    }

    async handleLedgerSync(payload) {
        console.log(`[Job Worker] Syncing ledger for payment ${payload.paymentReference}`);
        return true;
    }

    /**
     * Process a batch of pending jobs
     */
    async processPendingJobs(batchSize = 10) {
        const jobs = await this.repository.getPendingJobs(batchSize);
        const results = [];

        for (const job of jobs) {
            const handler = this.handlers[job.type];
            if (!handler) {
                console.warn(`[Job Worker] No handler registered for job type "${job.type}"`);
                await this.repository.updateJobStatus(job.id, 'DEAD_LETTER', `Unknown job type: ${job.type}`);
                continue;
            }

            try {
                await handler(job.payload);
                await this.repository.updateJobStatus(job.id, 'COMPLETED');
                results.push({ id: job.id, status: 'COMPLETED' });
            } catch (err) {
                console.error(`[Job Worker] Error executing job ${job.id} (attempt ${job.attempts + 1}/${job.maxAttempts}):`, err.message);

                if (job.attempts + 1 >= job.maxAttempts) {
                    // Principle #27: Move repeatedly failing jobs to DEAD_LETTER
                    await this.repository.updateJobStatus(job.id, 'DEAD_LETTER', err.message);
                    results.push({ id: job.id, status: 'DEAD_LETTER', error: err.message });
                } else {
                    // Principle #26: Exponential retry backoff
                    const backoffMs = Math.pow(2, job.attempts) * 5000;
                    await this.repository.updateJobStatus(job.id, 'FAILED', err.message, backoffMs);
                    results.push({ id: job.id, status: 'RETRY_SCHEDULED', backoffMs });
                }
            }
        }

        return results;
    }
}

module.exports = new PaymentJobRunner();
