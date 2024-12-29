const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db');

// Enable CORS for the backend to allow any origin
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Route to search for all services or by specific criteria
router.get('/servicessearch', async (req, res) => {
    const pool = getPool();
    const { servicoID, tipoID, localidadeServico } = req.query;

    // Set the search path to the servicosBD schema
    await pool.query('SET search_path TO servicosBD');

    let query = `
        SELECT sh.servicoID, sh.localidadeServico, sh.tipoID, ts.descricao, ts.servicoDisponivel24horas
        FROM Servico_Hospitalar sh
        JOIN Tipo_Servico ts ON sh.tipoID = ts.tipoID
        WHERE 1=1
    `;

    if (servicoID) {
        query += ` AND sh.servicoID = ${servicoID}`;
    }
    if (tipoID) {
        query += ` AND sh.tipoID = ${tipoID}`;
    }
    if (localidadeServico) {
        query += ` AND sh.localidadeServico ILIKE '%${localidadeServico}%'`;
    }

    try {
        const results = await pool.query(query);
        res.status(200).json(results.rows);
    } catch (error) {
        console.error('Error searching services:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
