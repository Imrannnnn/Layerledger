const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all clients for the tenant
 * @route   GET /api/clients
 * @access  Private
 */
const getClients = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { search, page, limit } = req.query;

    const where = { tenantId };
    if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
            { birthday: { contains: q, mode: 'insensitive' } }
        ];
    }

    if (page || limit) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 25);
        const skip = (pageNum - 1) * limitNum;
        const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });

        const [clients, total, totalClients, totalWithPhone, birthdaysThisMonth] = await Promise.all([
            prisma.client.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    _count: { select: { orders: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.client.count({ where }),
            prisma.client.count({ where: { tenantId } }),
            prisma.client.count({
                where: {
                    tenantId,
                    AND: [
                        { phone: { not: null } },
                        { phone: { not: "" } }
                    ]
                }
            }),
            prisma.client.count({
                where: {
                    tenantId,
                    birthday: { contains: currentMonthName, mode: 'insensitive' }
                }
            })
        ]);

        return res.json({
            data: clients.map(c => ({
                ...c,
                ordersCount: c._count?.orders ?? 0
            })),
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            },
            stats: {
                totalClients,
                totalWithPhone,
                birthdaysThisMonth
            }
        });
    }

    const clients = await prisma.client.findMany({
        where,
        include: {
            _count: { select: { orders: true } }
        },
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
    const { name, phone, email, address, notes, birthday } = req.body;

    const client = await prisma.client.create({
        data: {
            tenantId,
            name,
            phone,
            email,
            address,
            notes,
            birthday: birthday || null
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
    const { name, phone, email, address, notes, birthday } = req.body;

    const updatedClient = await prisma.client.updateMany({
        where: { id: req.params.id, tenantId },
        data: { name, phone, email, address, notes, birthday: birthday !== undefined ? (birthday || null) : undefined }
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
