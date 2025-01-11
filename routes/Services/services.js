const express = require('express');
const cors = require('cors');
const router = express.Router();
const { executeQuery } = require('../../db');

// Example admin check middleware
const isAdmin = (req, res, next) => {
    // Replace with your actual authentication and admin validation logic
    const userRole = req.headers['x-user-role']; // Example custom header
    if (userRole && userRole === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Access denied. Admins only.' });
};

// CORS Configuration
const corsOptions = {
    origin: '*', // Replace with specific origin in production for security
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-user-role'],
};

router.use(cors(corsOptions));

// Helper to handle query execution
async function handleQueryExecution(query, params, res, successStatus = 200) {
    try {
        const results = await executeQuery(query, params);
        res.status(successStatus).json(results.recordset);
    } catch (error) {
        console.error('Database query error:', error.message);
        res.status(500).json({ error: error.message });
    }
}

// Fetch all services or search by criteria
router.get('/all', async (req, res) => {
    const { servicoID, localidadeServico } = req.query;
    let query = `
        SELECT servicoID, localidadeServico, nomeServico, descServico, servicoDisponivel24horas
        FROM SERVICOSDB.dbo.Servico_Hospitalar
        WHERE 1=1
    `;
    const params = {};

    if (servicoID) {
        query += ' AND servicoID = @servicoID';
        params.servicoID = servicoID;
    }

    if (localidadeServico) {
        query += ' AND localidadeServico LIKE @localidadeServico';
        params.localidadeServico = `%${localidadeServico}%`;
    }

    handleQueryExecution(query, params, res);
});

// Fetch specific service and its medication stock
router.get('/servico/:id/stock', async (req, res) => {
    const { id } = req.params;

    try {
        const serviceQuery = `
            SELECT servicoID, nomeServico, descServico, localidadeServico, servicoDisponivel24horas
            FROM SERVICOSDB.dbo.Servico_Hospitalar
            WHERE servicoID = @id;
        `;

        const stockQuery = `
            SELECT ms.medicamentoID, m.nomeMedicamento, ms.quantidadeDisponivel, ms.quantidadeMinima
            FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar ms
            JOIN SERVICOSDB.dbo.Medicamento m ON ms.medicamentoID = m.medicamentoID
            WHERE ms.servicoID = @id;
        `;

        const serviceResult = await executeQuery(serviceQuery, { id });
        if (serviceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }

        const stockResult = await executeQuery(stockQuery, { id });
        res.status(200).json({ service: serviceResult.recordset[0], stock: stockResult.recordset });
    } catch (error) {
        console.error('Error fetching service and stock details:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Admin-only: Create or Update stock
router.put('/servico/:id/stock', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { medicamentoID, quantidadeDisponivel, quantidadeMinima } = req.body;

    try {
        const selectStockQuery = `
            SELECT medicamentoID FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
            WHERE servicoID = @id AND medicamentoID = @medicamentoID;
        `;
        const updateStockQuery = `
            UPDATE SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
            SET quantidadeDisponivel = @quantidadeDisponivel, quantidadeMinima = @quantidadeMinima
            WHERE servicoID = @id AND medicamentoID = @medicamentoID;
        `;
        const insertStockQuery = `
            INSERT INTO SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
            (servicoID, medicamentoID, quantidadeDisponivel, quantidadeMinima)
            VALUES (@id, @medicamentoID, @quantidadeDisponivel, @quantidadeMinima);
        `;

        const stockCheck = await executeQuery(selectStockQuery, { id, medicamentoID });

        if (stockCheck.recordset.length > 0) {
            // Stock exists, update it
            await executeQuery(updateStockQuery, { id, medicamentoID, quantidadeDisponivel, quantidadeMinima });
            res.status(200).json({ message: 'Stock updated successfully.' });
        } else {
            // Stock does not exist, insert new record
            await executeQuery(insertStockQuery, { id, medicamentoID, quantidadeDisponivel, quantidadeMinima });
            res.status(201).json({ message: 'Stock added successfully.' });
        }
    } catch (error) {
        console.error('Error managing stock:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Admin-only: Create a new Servico_Hospitalar
router.post('/add', isAdmin, async (req, res) => {
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;

    const insertQuery = `
        INSERT INTO SERVICOSDB.dbo.Servico_Hospitalar
        (localidadeServico, nomeServico, descServico, servicoDisponivel24horas)
        VALUES (@localidadeServico, @nomeServico, @descServico, @servicoDisponivel24horas);
    `;

    try {
        await executeQuery(insertQuery, { localidadeServico, nomeServico, descServico, servicoDisponivel24horas });
        res.status(201).json({ message: 'Servico_Hospitalar created successfully.' });
    } catch (error) {
        console.error('Error creating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
