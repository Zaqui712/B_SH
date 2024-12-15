const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path


// Enable CORS for the backend to allow any origin
const corsOptions = {
    origin: '*', // Allow any origin
    methods: ['GET', 'POST'], // Allowed methods
    allowedHeaders: ['Content-Type'], // Allowed headers
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Function to check values and alerts 
const checkDatabase = async (req, res) => {
    try {
        const pool = getPool();
        const query = `
            SELECT msh.medicamentoid, msh.servicoid, msh.quantidadedisponivel, msh.quantidademinima,
                   m.nomeMedicamento, tm.descricao
            FROM servicosBD.Medicamento_Servico_Hospitalar msh
            JOIN servicosBD.Medicamento m ON msh.medicamentoid = m.medicamentoid
            JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
            WHERE msh.quantidadedisponivel < msh.quantidademinima
        `;
        const result = await pool.query(query);
        if (result.rows.length > 0) {
            console.log('Medicamentos abaixo da quantidade mínima:');
            result.rows.forEach(row => {
                console.log(`- Nome: ${row.nomeMedicamento}, Descrição: ${row.descricao}, Quantidade Disponível: ${row.quantidadedisponivel}, Quantidade Mínima: ${row.quantidademinima}`);
            });
            res.status(200).json(result.rows);
        } else {
            console.log('Todos os medicamentos estão acima da quantidade mínima.');
            res.status(200).json({ message: 'Todos os medicamentos estão acima da quantidade mínima.' });
        }
    } catch (error) {
        console.error('Error checking database:', error.message);
        res.status(500).send('Error checking database');
    }
};
// Function to check inventory values only
const checkInventory = async (req, res) => {
    try {
        const pool = getPool();
        const query = `
            SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
            FROM servicosBD.Medicamento m
            JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
            JOIN servicosBD.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
            WHERE msh.quantidadedisponivel > 0
        `;
        const result = await pool.query(query);
        if (result.rows.length > 0) {
            console.log('Medicamentos disponíveis:');
            result.rows.forEach(row => {
                console.log(`- Nome: ${row.nomeMedicamento}, Descrição: ${row.descricao}, Quantidade Disponível: ${row.quantidadedisponivel}`);
            });
            res.status(200).json(result.rows);
        } else {
            console.log('Nenhum medicamento disponível no estoque.');
            res.status(200).json({ message: 'Nenhum medicamento disponível no estoque.' });
        }
    } catch (error) {
        console.error('Error checking inventory:', error.message);
        res.status(500).send('Error checking inventory');
    }
};
// Function to search for a product
const searchProduct = async (req, res) => {
    try {
        const pool = getPool();
        const { query } = req.query; // Capture the query parameter

        if (!query) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const sqlQuery = `
            SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
            FROM servicosBD.Medicamento m
            JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
            JOIN servicosBD.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
            WHERE m.nomeMedicamento ILIKE $1
        `;

        const result = await pool.query(sqlQuery, [`%${query}%`]);

        if (result.rows.length > 0) {
            console.log('Produtos encontrados:');
            result.rows.forEach(row => {
                console.log(`- Nome: ${row.nomeMedicamento}, Descrição: ${row.descricao}, Quantidade Disponível: ${row.quantidadedisponivel}`);
            });
            res.status(200).json(result.rows);
        } else {
            console.log('Nenhum produto encontrado com a consulta fornecida.');
            res.status(404).json({ message: 'Nenhum produto encontrado com a consulta fornecida.' });
        }
    } catch (error) {
        console.error('Error searching product:', error.message);
        res.status(500).send('Error searching product');
    }
};
// Route to check database values
router.get('/check', checkDatabase);

// Route to check inventory values
router.get('/inventory', checkInventory);

// Route to search for a product
router.get('/search', searchProduct);

module.exports = router;
