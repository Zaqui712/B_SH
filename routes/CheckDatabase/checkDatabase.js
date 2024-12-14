const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Enable CORS for the backend
const corsOptions = {
    origin: 'http://localhost:3000', // Allow the frontend domain
    methods: ['GET', 'POST'], // Allowed methods
    allowedHeaders: ['Content-Type'], // Allowed headers
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Function to check database values
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

// Route to check database values
router.get('/check', checkDatabase);

module.exports = router;
