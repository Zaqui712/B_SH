const express = require('express');
const cors = require('cors');
const router = express.Router();
const { executeQuery } = require('../../db'); // Ensure your DB connection is correctly set up and referenced

// Enable CORS
const corsOptions = {
    origin: '*',  // Replace '*' with a specific domain for security
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
};

router.use(cors(corsOptions));

// CREATE Fornecedor
router.post('/create', async (req, res) => {
    const { nomeFornecedor, contactoFornecedor, emailFornecedor } = req.body;
    
    const query = `
        INSERT INTO Fornecedor (nomeFornecedor, contactoFornecedor, emailFornecedor)
        VALUES (@nomeFornecedor, @contactoFornecedor, @emailFornecedor)
    `;

    try {
        await executeQuery(query, { nomeFornecedor, contactoFornecedor, emailFornecedor });
        res.status(201).send({ message: 'Fornecedor created successfully' });
    } catch (error) {
        console.error('Error creating fornecedor:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

// READ Fornecedor (View All)
router.get('/all', async (req, res) => {
    const query = 'SELECT * FROM Fornecedor';

    try {
        const results = await executeQuery(query);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching fornecedores:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

// READ Fornecedor by ID
router.get('/searchbyid/:id', async (req, res) => {
    const query = 'SELECT * FROM Fornecedor WHERE fornecedorID = @id';
    const params = { id: req.params.id };

    try {
        const results = await executeQuery(query, params);
        if (results.length > 0) {
            res.status(200).json(results[0]);
        } else {
            res.status(404).send({ message: 'Fornecedor not found' });
        }
    } catch (error) {
        console.error('Error fetching fornecedor:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

// UPDATE Fornecedor by ID
router.put('/updatebyid/:id', async (req, res) => {
    const { nomeFornecedor, contactoFornecedor, emailFornecedor } = req.body;
    const query = `
        UPDATE Fornecedor
        SET nomeFornecedor = @nomeFornecedor,
            contactoFornecedor = @contactoFornecedor,
            emailFornecedor = @emailFornecedor
        WHERE fornecedorID = @id
    `;
    const params = { id: req.params.id, nomeFornecedor, contactoFornecedor, emailFornecedor };

    try {
        await executeQuery(query, params);
        res.status(200).send({ message: 'Fornecedor updated successfully' });
    } catch (error) {
        console.error('Error updating fornecedor:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

// DELETE Fornecedor by ID
router.delete('/deletebyid/:id', async (req, res) => {
    const query = 'DELETE FROM Fornecedor WHERE fornecedorID = @id';
    const params = { id: req.params.id };

    try {
        await executeQuery(query, params);
        res.status(200).send({ message: 'Fornecedor deleted successfully' });
    } catch (error) {
        console.error('Error deleting fornecedor:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

module.exports = router;
