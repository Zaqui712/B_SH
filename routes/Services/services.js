const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db');

// Enable CORS for the backend to allow any origin
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

// Route to list all Tipo_Servicos
router.get('/tiposervicos', async (req, res) => {
    const pool = getPool();

    try {
        await pool.query('SET search_path TO servicosBD');
        const query = `
            SELECT tipoID, descricao, servicoDisponivel24horas
            FROM Tipo_Servico;
        `;
        const results = await pool.query(query);
        res.status(200).json(results.rows);
    } catch (error) {
        console.error('Error listing Tipo_Servicos:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route to create a new Servico_Hospitalar
router.post('/servico', async (req, res) => {
    const pool = getPool();
    const { localidadeServico, tipoID } = req.body;

    try {
        await pool.query('SET search_path TO servicosBD');
        const query = `
            INSERT INTO Servico_Hospitalar (localidadeServico, tipoID)
            VALUES ($1, $2) RETURNING *;
        `;
        const values = [localidadeServico, tipoID];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route to update a Servico_Hospitalar by ID
router.put('/servico/:id', async (req, res) => {
    const pool = getPool();
    const { id } = req.params;
    const { localidadeServico, tipoID } = req.body;

    try {
        await pool.query('SET search_path TO servicosBD');
        const query = `
            UPDATE Servico_Hospitalar
            SET localidadeServico = $1, tipoID = $2
            WHERE servicoID = $3 RETURNING *;
        `;
        const values = [localidadeServico, tipoID, id];
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error updating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route to delete a Servico_Hospitalar by ID
router.delete('/servico/:id', async (req, res) => {
    const pool = getPool();
    const { id } = req.params;

    try {
        await pool.query('SET search_path TO servicosBD');
        const query = `
            DELETE FROM Servico_Hospitalar
            WHERE servicoID = $1 RETURNING *;
        `;
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }
        res.status(200).json({ message: 'Servico_Hospitalar deleted successfully' });
    } catch (error) {
        console.error('Error deleting Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
