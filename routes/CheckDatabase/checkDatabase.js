const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Database connection pool

// Enable CORS for the backend
router.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type'],
}));

// Helper function for database queries
const executeQuery = async (query, params = []) => {
    const pool = getPool();
    try {
        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        throw new Error(`Database error: ${error.message}`);
    }
};

// Function to check values and alerts
const checkDatabase = async (req, res) => {
    const query = `
        SELECT msh.medicamentoid, msh.servicoid, msh.quantidadedisponivel, msh.quantidademinima,
               m.nomeMedicamento, tm.descricao
        FROM servicosBD.Medicamento_Servico_Hospitalar msh
        JOIN servicosBD.Medicamento m ON msh.medicamentoid = m.medicamentoid
        JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
        WHERE msh.quantidadedisponivel < msh.quantidademinima
    `;
    try {
        const results = await executeQuery(query);
        if (results.length > 0) {
            console.log('Medicamentos abaixo da quantidade mínima:', results);
            res.status(200).json(results);
        } else {
            res.status(200).json({ message: 'Todos os medicamentos estão acima da quantidade mínima.' });
        }
    } catch (error) {
        console.error('Error checking database:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Function to check inventory values
const checkInventory = async (req, res) => {
    const query = `
        SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
        FROM servicosBD.Medicamento m
        JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
        JOIN servicosBD.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
        WHERE msh.quantidadedisponivel > 0
    `;
    try {
        const results = await executeQuery(query);
        if (results.length > 0) {
            console.log('Medicamentos disponíveis:', results);
            res.status(200).json(results);
        } else {
            res.status(200).json({ message: 'Nenhum medicamento disponível no estoque.' });
        }
    } catch (error) {
        console.error('Error checking inventory:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Function to search for a product
const searchProduct = async (req, res) => {
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

    try {
        const results = await executeQuery(sqlQuery, [`%${query}%`]);
        if (results.length > 0) {
            console.log('Produtos encontrados:', results);
            res.status(200).json(results);
        } else {
            res.status(404).json({ message: 'Nenhum produto encontrado com a consulta fornecida.' });
        }
    } catch (error) {
        console.error('Error searching product:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Rota para atualizar estoque manualmente
router.put('/estoque/atualizar', async (req, res) => {
    const { medicamentoID, novaQuantidade } = req.body;

    if (!medicamentoID || novaQuantidade === undefined) {
        return res.status(400).json({ message: 'ID do medicamento e nova quantidade são obrigatórios.' });
    }

    const query = `
        UPDATE servicosBD.Medicamento_Servico_Hospitalar
        SET quantidadedisponivel = $1
        WHERE medicamentoID = $2
        RETURNING *
    `;

    try {
        const results = await executeQuery(query, [novaQuantidade, medicamentoID]);
        if (results.length > 0) {
            res.status(200).json({ message: 'Estoque atualizado com sucesso.', medicamento: results[0] });
        } else {
            res.status(404).json({ message: 'Medicamento não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao atualizar estoque:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Rota para adicionar novo medicamento
router.post('/novo', async (req, res) => {
    const { nomeMedicamento, tipoID, descricao } = req.body;

    if (!nomeMedicamento || !tipoID || !descricao) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    const query = `
        INSERT INTO servicosBD.Medicamento (nomeMedicamento, tipoID, descricao)
        VALUES ($1, $2, $3)
        RETURNING *
    `;

    try {
        const results = await executeQuery(query, [nomeMedicamento, tipoID, descricao]);
        res.status(201).json({ message: 'Medicamento criado com sucesso.', medicamento: results[0] });
    } catch (error) {
        console.error('Erro ao adicionar medicamento:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Route to check database values
router.get('/check', checkDatabase);

// Assuming checkDatabase is already imported or defined
router.get('/alertas', checkDatabase); // Connect the route to checkDatabase function

// Route to check inventory values
router.get('/inventory', checkInventory);

// Route to search for a product
router.get('/search', searchProduct);

module.exports = router;
