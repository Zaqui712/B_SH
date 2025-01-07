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
router.get('/servicessearch', async (req, res) => {
    const { servicoID, localidadeServico } = req.query;

    // Base query to fetch services
    let query = `
    SELECT sh.servicoID, sh.localidadeServico, sh.nomeServico, sh.descServico, sh.servicoDisponivel24horas
    FROM SERVICOSDB.dbo.Servico_Hospitalar sh
    WHERE 1=1
	`;

    // Prepare the parameters object
    const params = {};

    console.log('Received query parameters:', req.query); // Log received query parameters

    // Add conditions to query if the parameters are provided
    if (servicoID) {
        query += ` AND sh.servicoID = @servicoID`;
        params.servicoID = servicoID;
    }

    if (localidadeServico) {
        query += ` AND sh.localidadeServico LIKE @localidadeServico`;
        params.localidadeServico = `%${localidadeServico}%`;  // Add wildcard for LIKE query
    }

    // Ensure no parameters are sent as undefined or null
    if (Object.keys(params).length === 0) {
        console.log('No valid search parameters provided'); // Log if no parameters are valid
        return res.status(400).json({ error: 'No valid search parameters provided.' });
    }

    console.log('Executing query:', query); // Log the final query being executed
    console.log('With parameters:', params); // Log the parameters

    try {
        // Execute the query with parameters
        const results = await executeQuery(query, params);
        console.log('Query results:', results); // Log the query results
        res.status(200).json(results.recordset);
    } catch (error) {
        console.error('Error searching services:', error.message); // Log the error message
        res.status(500).json({ error: error.message });
    }
});

// Route to create a new Servico_Hospitalar
router.post('/servico-completo', async (req, res) => {
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;

    console.log('Received body:', req.body); // Log the received body

    try {
        const servicoQuery = `
		INSERT INTO SERVICOSDB.dbo.Servico_Hospitalar (localidadeServico, nomeServico, descServico, servicoDisponivel24horas)
		VALUES (@localidadeServico, @nomeServico, @descServico, @servicoDisponivel24horas)
        OUTPUT INSERTED.servicoID, INSERTED.localidadeServico, INSERTED.nomeServico, INSERTED.descServico, INSERTED.servicoDisponivel24horas;
		`;

        const servicoValues = { localidadeServico, nomeServico, descServico, servicoDisponivel24horas };

        console.log('Executing query:', servicoQuery); // Log the insert query
        console.log('With values:', servicoValues); // Log the insert values

        const servicoResult = await executeQuery(servicoQuery, servicoValues);
        console.log('Insert result:', servicoResult); // Log the result of the insert query

        res.status(201).json(servicoResult.recordset[0]);
    } catch (error) {
        console.error('Error creating Servico_Hospitalar:', error.message); // Log error message
        res.status(500).json({ error: error.message });
    }
});

// Route to update a Servico_Hospitalar by ID
router.put('/servico/:id', async (req, res) => {
    const { id } = req.params;
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;

    console.log('Received ID:', id); // Log the received ID
    console.log('Received body:', req.body); // Log the received body

    try {
        const query = `
		UPDATE SERVICOSDB.dbo.Servico_Hospitalar
		SET localidadeServico = @localidadeServico, nomeServico = @nomeServico, descServico = @descServico, servicoDisponivel24horas = @servicoDisponivel24horas
		WHERE servicoID = @id
		OUTPUT INSERTED.servicoID, INSERTED.localidadeServico, INSERTED.nomeServico, INSERTED.descServico, INSERTED.servicoDisponivel24horas;
		`;

        const values = { localidadeServico, nomeServico, descServico, servicoDisponivel24horas, id };

        console.log('Executing query:', query); // Log the update query
        console.log('With values:', values); // Log the update values

        const result = await executeQuery(query, values);
        console.log('Update result:', result); // Log the result of the update query

        if (result.recordset.length === 0) {
            console.log('Servico_Hospitalar not found'); // Log if no records are found
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }
        res.status(200).json(result.recordset[0]);
    } catch (error) {
        console.error('Error updating Servico_Hospitalar:', error.message); // Log error message
        res.status(500).json({ error: error.message });
    }
});

// Route to delete a Servico_Hospitalar by ID
router.delete('/servico/:id', async (req, res) => {
    const { id } = req.params;

    console.log('Received ID:', id); // Log the received ID

    try {
        const query = `
		DELETE FROM SERVICOSDB.dbo.Servico_Hospitalar
		WHERE servicoID = @id
		OUTPUT DELETED.servicoID, DELETED.localidadeServico, DELETED.nomeServico, DELETED.descServico, DELETED.servicoDisponivel24horas;
		`;

        console.log('Executing query:', query); // Log the delete query
        console.log('With ID:', id); // Log the ID used in the delete query

        const result = await executeQuery(query, { id });
        console.log('Delete result:', result); // Log the result of the delete query

        if (result.recordset.length === 0) {
            console.log('Servico_Hospitalar not found'); // Log if no records are found
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }
        res.status(200).json({ message: 'Servico_Hospitalar deleted successfully' });
    } catch (error) {
        console.error('Error deleting Servico_Hospitalar:', error.message); // Log error message
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
