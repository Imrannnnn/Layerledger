const prisma = require('../prisma');

/**
 * @desc    Get all clients for the tenant
 * @route   GET /api/clients
 * @access  Private
 */
const getClients = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const clients = await prisma.client.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(clients);
    } catch (error) {
        console.error("Error in getClients:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get a specific client by ID
 * @route   GET /api/clients/:id
 * @access  Private
 */
const getClientById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const client = await prisma.client.findFirst({
            where: { id: req.params.id, tenantId }
        });
        
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }
        res.json(client);
    } catch (error) {
        console.error("Error in getClientById:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new client
 * @route   POST /api/clients
 * @access  Private
 */
const createClient = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, phone, email, address, notes } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Client name is required' });
        }

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
    } catch (error) {
        console.error("Error in createClient:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update a client's details
 * @route   PUT /api/clients/:id
 * @access  Private
 */
const updateClient = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, phone, email, address, notes } = req.body;

        if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
            return res.status(400).json({ message: 'Client name cannot be empty' });
        }

        const updatedClient = await prisma.client.updateMany({
            where: { id: req.params.id, tenantId },
            data: { name, phone, email, address, notes }
        });

        if (updatedClient.count === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }
        
        const client = await prisma.client.findFirst({
            where: { id: req.params.id, tenantId }
        });
        res.json(client);
    } catch (error) {
        console.error("Error in updateClient:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete a client
 * @route   DELETE /api/clients/:id
 * @access  Private
 */
const deleteClient = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deletedClient = await prisma.client.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deletedClient.count === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }
        res.json({ message: 'Client removed successfully' });
    } catch (error) {
        console.error("Error in deleteClient:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient
};
