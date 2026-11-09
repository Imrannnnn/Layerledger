/**
 * LayerLedger Accounting Reversal Service
 * Implements Rule 2 from the accounting specification:
 * "Entries are never edited or deleted. A correction is a new reversing entry.
 * This is what makes the books auditable, and it is what stops a single edit
 * silently moving a figure in three reports at once."
 */

const prisma = require('../../../prisma');
const postingService = require('./posting.service');
const { ENTRY_STATUS } = require('../accounting.constants');

class ReversalService {
    /**
     * Reverses an existing posted journal entry by creating a mirror entry
     * with debits and credits swapped, atomically linking the two.
     *
     * @param {string} tenantId - Tenant UUID
     * @param {string} entryId - ID of the JournalEntry to reverse
     * @param {string} reason - Justification for the reversal
     * @param {string|null} userId - User executing the reversal
     * @param {object|null} externalTx - Optional existing Prisma transaction
     * @returns {Promise<{ original: object, reversal: object }>}
     */
    async reverseJournalEntry(tenantId, entryId, reason, userId = null, externalTx = null) {
        if (!tenantId || !entryId) {
            throw new Error('tenantId and entryId are required for reversal');
        }

        const runWithTx = async (tx) => {
            const original = await tx.journalEntry.findFirst({
                where: { id: entryId, tenantId },
                include: {
                    lines: {
                        include: { account: true }
                    }
                }
            });

            if (!original) {
                throw new Error(`Journal entry ${entryId} not found for this tenant`);
            }

            if (original.status === ENTRY_STATUS.REVERSED) {
                throw new Error(`Journal entry ${original.entryNumber} has already been reversed`);
            }

            // Create mirror reversing lines:
            // For each original line: Debit becomes Credit, Credit becomes Debit
            const reversingLines = original.lines.map(line => ({
                accountId: line.accountId,
                accountCode: line.account.accountCode,
                debit: line.credit.toString(),
                credit: line.debit.toString(),
                description: `Reversal of ${original.entryNumber} line: ${line.description || original.memo || ''}`.trim()
            }));

            const memo = `Reversal of ${original.entryNumber}${reason ? ` - Reason: ${reason}` : ''}`;

            // Post reversing journal entry
            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: new Date(),
                sourceType: 'reversal',
                sourceId: original.id,
                memo,
                lines: reversingLines,
                createdBy: userId,
                reversalOfId: original.id
            }, tx);

            const reversalEntry = postResult.entry;

            // Mark original entry as REVERSED
            const updatedOriginal = await tx.journalEntry.update({
                where: { id: original.id },
                data: {
                    status: ENTRY_STATUS.REVERSED
                }
            });

            return {
                original: updatedOriginal,
                reversal: reversalEntry
            };
        };

        if (externalTx) {
            return await runWithTx(externalTx);
        }

        return await prisma.$transaction(async (tx) => {
            return await runWithTx(tx);
        }, { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Reverses a journal entry associated with a specific source document
     * (e.g. when an order, purchase, or expense is cancelled or deleted).
     */
    async reverseBySource(tenantId, sourceType, sourceId, reason, userId = null, externalTx = null) {
        const client = externalTx || prisma;
        const entry = await client.journalEntry.findFirst({
            where: {
                tenantId,
                sourceType,
                sourceId: String(sourceId),
                status: ENTRY_STATUS.POSTED
            }
        });

        if (!entry) {
            return null; // No posted entry exists to reverse
        }

        return await this.reverseJournalEntry(tenantId, entry.id, reason, userId, externalTx);
    }
}

module.exports = new ReversalService();
