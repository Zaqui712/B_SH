const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Database connection pool

// Enable CORS for the backend
router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
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

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  const { adminID } = req.body;
  try {
    const pool = getPool();
    const query = 'SELECT utilizadorAdministrador FROM servicosBD.Credenciais WHERE credenciaisID = $1';
    const result = await pool.query(query, [adminID]);
    if (result.rows.length > 0 && result.rows[0].utilizadoradministrador) {
      next();
    } else {
      res.status(403).send('Access denied. Only administrators can perform this action.');
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
};

// CREATE
// Route to add a new medication
router.post('/novo', verifyAdmin, async (req, res) => {
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

// READ
// Route to list all medications
router.get('/todos', async (req, res) => {
  const query = `
    SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
    FROM servicosBD.Medicamento m
    JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    JOIN servicosBD.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
  `;
  try {
    const results = await executeQuery(query);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error listing medications:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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

router.get('/search', searchProduct);

// UPDATE
// Route to update medication information
router.put('/atualizar/:medicamentoID', async (req, res) => {
  const { medicamentoID } = req.params;
  const { nomeMedicamento, tipoID, descricao } = req.body;

  if (!nomeMedicamento || !tipoID || !descricao) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  const query = `
    UPDATE servicosBD.Medicamento
    SET nomeMedicamento = $1, tipoID = $2, descricao = $3
    WHERE medicamentoID = $4
    RETURNING *
  `;

  try {
    const results = await executeQuery(query, [nomeMedicamento, tipoID, descricao, medicamentoID]);
    if (results.length > 0) {
      res.status(200).json({ message: 'Medicamento atualizado com sucesso.', medicamento: results[0] });
    } else {
      res.status(404).json({ message: 'Medicamento não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao atualizar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE
// Route to delete a medication
router.delete('/deletar/:medicamentoID', verifyAdmin, async (req, res) => {
  const { medicamentoID } = req.params;

  const query = `
    DELETE FROM servicosBD.Medicamento
    WHERE medicamentoID = $1
    RETURNING *
  `;

  try {
    const results = await executeQuery(query, [medicamentoID]);
    if (results.length > 0) {
      res.status(200).json({ message: 'Medicamento deletado com sucesso.', medicamento: results[0] });
    } else {
      res.status(404).json({ message: 'Medicamento não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao deletar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
