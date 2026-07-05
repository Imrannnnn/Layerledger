const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all clients for the tenant
 * @route   GET /api/clients
 * @access  Private
 */
const getClients = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const clients = await prisma.client.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(clients);
});

/**
 * @desc    Get a specific client by ID
 * @route   GET /api/clients/:id
 * @access  Private
 */
const getClientById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const client = await prisma.client.findFirst({
        where: { id: req.params.id, tenantId }
    });
    
    if (!client) {
        res.status(404);
        throw new Error('Client not found');
    }
    res.json(client);
});

/**
 * @desc    Create a new client
 * @route   POST /api/clients
 * @access  Private
 */
const createClient = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, phone, email, address, notes } = req.body;

    const client = await prisma.client.create({
        data: {
            tenantId,
            name,
            phone,
            email,
            address,
            notes
        }
    });
    res.status(201).json(client);
});

/**
 * @desc    Update a client's details
 * @route   PUT /api/clients/:id
 * @access  Private
 */
const updateClient = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, phone, email, address, notes } = req.body;

    const updatedClient = await prisma.client.updateMany({
        where: { id: req.params.id, tenantId },
        data: { name, phone, email, address, notes }
    });

    if (updatedClient.count === 0) {
        res.status(404);
        throw new Error('Client not found');
    }
    
    const client = await prisma.client.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(client);
});

/**
 * @desc    Delete a client
 * @route   DELETE /api/clients/:id
 * @access  Private
 */
const deleteClient = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const deletedClient = await prisma.client.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deletedClient.count === 0) {
        res.status(404);
        throw new Error('Client not found');
    }
    res.json({ message: 'Client removed successfully' });
});

module.exports = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient
};
