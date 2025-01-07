const express = require('express');
const cors = require('cors');
const router = express.Router();
const { executeQuery } = require('../../db');

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
    const { servicoID, localidadeServico } = req.query;

    let query = `
        SELECT sh.servicoID, sh.localidadeServico, sh.nomeServico, sh.descServico, sh.servicoDisponivel24horas
        FROM SERVICOSDB.Servico_Hospitalar sh
        WHERE 1=1
    `;

    if (servicoID) {
        query += ` AND sh.servicoID = @servicoID`;
    }
    if (localidadeServico) {
        query += ` AND sh.localidadeServico LIKE @localidadeServico`;
    }

    try {
        const params = {
            servicoID: servicoID,
            localidadeServico: `%${localidadeServico}%`
        };
        const results = await executeQuery(query, params);
        res.status(200).json(results.recordset);
    } catch (error) {
        console.error('Error searching services:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route to create a new Servico_Hospitalar
router.post('/servico-completo', async (req, res) => {
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;

    try {
        const servicoQuery = `
            INSERT INTO SERVICOSDB.Servico_Hospitalar (localidadeServico, nomeServico, descServico, servicoDisponivel24horas)
            VALUES (@localidadeServico, @nomeServico, @descServico, @servicoDisponivel24horas) OUTPUT INSERTED.*;
        `;
        const servicoValues = { localidadeServico, nomeServico, descServico, servicoDisponivel24horas };
        const servicoResult = await executeQuery(servicoQuery, servicoValues);

        res.status(201).json(servicoResult.recordset[0]);
    } catch (error) {
        console.error('Error creating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route to update a Servico_Hospitalar by ID
router.put('/servico/:id', async (req, res) => {
    const { id } = req.params;
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;

    try {
        const query = `
            UPDATE SERVICOSDB.Servico_Hospitalar
            SET localidadeServico = @localidadeServico, nomeServico = @nomeServico, descServico = @descServico, servicoDisponivel24horas = @servicoDisponivel24horas
            WHERE servicoID = @id OUTPUT INSERTED.*;
        `;
        const values = { localidadeServico, nomeServico, descServico, servicoDisponivel24horas, id };
        const result = await executeQuery(query, values);
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }
        res.status(200).json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route to delete a Servico_Hospitalar by ID
router.delete('/servico/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            DELETE FROM SERVICOSDB.Servico_Hospitalar
            WHERE servicoID = @id OUTPUT DELETED.*;
        `;
        const result = await executeQuery(query, { id });
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }
        res.status(200).json({ message: 'Servico_Hospitalar deleted successfully' });
    } catch (error) {
        console.error('Error deleting Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;