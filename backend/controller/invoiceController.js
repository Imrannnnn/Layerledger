const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all invoices for the tenant
 * @route   GET /api/invoices
 * @access  Private
 */
const getInvoices = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const invoices = await prisma.invoice.findMany({
        where: { tenantId },
        include: {
            order: { select: { totalPrice: true, status: true, clientId: true } }
        },
        orderBy: { issueDate: 'desc' }
    });
    res.json(invoices);
});

/**
 * @desc    Create a new invoice
 * @route   POST /api/invoices
 * @access  Private
 */
const createInvoice = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { orderId, invoiceNumber, issueDate, dueDate, status, notes } = req.body;

    const invoice = await prisma.invoice.create({
        data: {
            id: req.body.id || undefined,
            tenantId,
            orderId,
            invoiceNumber,
            issueDate: issueDate ? new Date(issueDate) : new Date(),
            dueDate: dueDate ? new Date(dueDate) : null,
            status: status || 'draft',
            notes
        },
        include: { order: { select: { totalPrice: true } } }
    });
    res.status(201).json(invoice);
});

/**
 * @desc    Update an invoice
 * @route   PUT /api/invoices/:id
 * @access  Private
 */
const updateInvoice = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { orderId, invoiceNumber, issueDate, dueDate, status, notes } = req.body;

    const updatedInvoice = await prisma.invoice.updateMany({
        where: { id: req.params.id, tenantId },
        data: {
            orderId,
            invoiceNumber,
            issueDate: issueDate ? new Date(issueDate) : undefined,
            dueDate: dueDate ? new Date(dueDate) : null,
            status,
            notes
        }
    });

    if (updatedInvoice.count === 0) {
        res.status(404);
        throw new Error('Invoice not found');
    }
    
    const invoice = await prisma.invoice.findFirst({ 
        where: { id: req.params.id, tenantId },
        include: { order: { select: { totalPrice: true } } }
    });
    res.json(invoice);
});

/**
 * @desc    Delete an invoice
 * @route   DELETE /api/invoices/:id
 * @access  Private
 */
const deleteInvoice = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const deletedInvoice = await prisma.invoice.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deletedInvoice.count === 0) {
        res.status(404);
        throw new Error('Invoice not found');
    }
    res.json({ message: 'Invoice removed successfully' });
});

module.exports = {
    getInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice
};
