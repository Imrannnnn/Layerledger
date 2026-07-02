const prisma = require('../prisma');

/**
 * @desc    Get all invoices for the tenant
 * @route   GET /api/invoices
 * @access  Private
 */
const getInvoices = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const invoices = await prisma.invoice.findMany({
            where: { tenantId },
            include: {
                order: { select: { totalPrice: true, status: true, clientId: true } }
            },
            orderBy: { issueDate: 'desc' }
        });
        res.json(invoices);
    } catch (error) {
        console.error("Error in getInvoices:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new invoice
 * @route   POST /api/invoices
 * @access  Private
 */
const createInvoice = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { orderId, invoiceNumber, issueDate, dueDate, status, notes } = req.body;

        if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
            return res.status(400).json({ message: 'Order ID is required' });
        }
        if (!invoiceNumber || typeof invoiceNumber !== 'string' || invoiceNumber.trim() === '') {
            return res.status(400).json({ message: 'Invoice number is required' });
        }

        const invoice = await prisma.invoice.create({
            data: {
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
    } catch (error) {
        console.error("Error in createInvoice:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update an invoice
 * @route   PUT /api/invoices/:id
 * @access  Private
 */
const updateInvoice = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { orderId, invoiceNumber, issueDate, dueDate, status, notes } = req.body;

        if (orderId !== undefined && (typeof orderId !== 'string' || orderId.trim() === '')) {
            return res.status(400).json({ message: 'Order ID cannot be empty' });
        }
        if (invoiceNumber !== undefined && (typeof invoiceNumber !== 'string' || invoiceNumber.trim() === '')) {
            return res.status(400).json({ message: 'Invoice number cannot be empty' });
        }

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
            return res.status(404).json({ message: 'Invoice not found' });
        }
        
        const invoice = await prisma.invoice.findFirst({ 
            where: { id: req.params.id, tenantId },
            include: { order: { select: { totalPrice: true } } }
        });
        res.json(invoice);
    } catch (error) {
        console.error("Error in updateInvoice:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete an invoice
 * @route   DELETE /api/invoices/:id
 * @access  Private
 */
const deleteInvoice = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deletedInvoice = await prisma.invoice.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deletedInvoice.count === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        res.json({ message: 'Invoice removed successfully' });
    } catch (error) {
        console.error("Error in deleteInvoice:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice
};
