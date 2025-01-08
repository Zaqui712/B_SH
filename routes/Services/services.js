const express = require('express');
const cors = require('cors');
const router = express.Router();
const { executeQuery } = require('../../db');

// Enable CORS for the backend to allow specific origin
const corsOptions = {
    origin: '*', // Replace '*' with your domain in production for added security
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Route to search for all services or by specific criteria
router.get('/all', async (req, res) => {
    const { servicoID, localidadeServico } = req.query;
    
    // Base query to fetch services
    let query = `
    SELECT sh.servicoID, sh.localidadeServico, sh.nomeServico, sh.descServico, sh.servicoDisponivel24horas
    FROM SERVICOSDB.dbo.Servico_Hospitalar sh
    WHERE 1=1
	`;

    // Prepare the parameters object
    const params = {};

    // Add conditions to query if the parameters are provided
    if (servicoID) {
        query += ` AND sh.servicoID = @servicoID`;
        params.servicoID = servicoID;
    }
    if (localidadeServico) {
        query += ` AND sh.localidadeServico LIKE @localidadeServico`;
        params.localidadeServico = `%${localidadeServico}%`;  // Add wildcard for LIKE query
    }

    // If no parameters are provided, proceed with fetching all records
    if (Object.keys(params).length === 0) {
        try {
            // Execute the query for all records
            const results = await executeQuery(query, params);  // params is empty
            res.status(200).json(results.recordset);
        } catch (error) {
            console.error('Error fetching all services:', error.message);
            res.status(500).json({ error: error.message });
        }
    } else {
        // Execute the query with the provided parameters
        try {
            const results = await executeQuery(query, params);
            res.status(200).json(results.recordset);
        } catch (error) {
            console.error('Error searching services:', error.message);
            res.status(500).json({ error: error.message });
        }
    }
});


// Route to create a new Servico_Hospitalar
router.post('/add', async (req, res) => {
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;
    try {
        const insertQuery = `
            INSERT INTO SERVICOSDB.dbo.Servico_Hospitalar (localidadeServico, nomeServico, descServico, servicoDisponivel24horas)
            VALUES (@localidadeServico, @nomeServico, @descServico, @servicoDisponivel24horas);
        `;
        const selectQuery = `
            SELECT TOP 1 servicoID, localidadeServico, nomeServico, descServico, servicoDisponivel24horas
            FROM SERVICOSDB.dbo.Servico_Hospitalar
            WHERE localidadeServico = @localidadeServico AND nomeServico = @nomeServico
            ORDER BY servicoID DESC;
        `;
        const values = { localidadeServico, nomeServico, descServico, servicoDisponivel24horas };

        // Execute the insert query
        await executeQuery(insertQuery, values);

        // Fetch the newly inserted record
        const result = await executeQuery(selectQuery, values);
        res.status(201).json(result.recordset[0]);
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
        // Update the record
        const updateQuery = `
            UPDATE SERVICOSDB.dbo.Servico_Hospitalar
            SET localidadeServico = @localidadeServico, nomeServico = @nomeServico, descServico = @descServico, servicoDisponivel24horas = @servicoDisponivel24horas
            WHERE servicoID = @id;
        `;
        const values = { localidadeServico, nomeServico, descServico, servicoDisponivel24horas, id };
        const updateResult = await executeQuery(updateQuery, values);

        // Check if the update affected any rows
        if (updateResult.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }

        // Fetch the updated record
        const selectQuery = `
            SELECT servicoID, localidadeServico, nomeServico, descServico, servicoDisponivel24horas
            FROM SERVICOSDB.dbo.Servico_Hospitalar
            WHERE servicoID = @id;
        `;
        const updatedRecord = await executeQuery(selectQuery, { id });
        res.status(200).json(updatedRecord.recordset[0]);
    } catch (error) {
        console.error('Error updating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// Route to delete a Servico_Hospitalar by ID
router.delete('/servico/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch the record before deletion
        const selectQuery = `
            SELECT servicoID, localidadeServico, nomeServico, descServico, servicoDisponivel24horas
            FROM SERVICOSDB.dbo.Servico_Hospitalar
            WHERE servicoID = @id;
        `;
        const deleteQuery = `
            DELETE FROM SERVICOSDB.dbo.Servico_Hospitalar
            WHERE servicoID = @id;
        `;

        // Fetch record to ensure it exists
        const record = await executeQuery(selectQuery, { id });
        if (record.recordset.length === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }

        // Execute the delete query
        await executeQuery(deleteQuery, { id });
        res.status(200).json({ message: 'Servico_Hospitalar deleted successfully', record: record.recordset[0] });
    } catch (error) {
        console.error('Error deleting Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
