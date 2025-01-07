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
  const pool = await getPool();
  try {
    const result = await pool.request().query(query, params);
    return result.recordset;
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
};

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  const { adminID } = req.body;
  try {
    const pool = await getPool();
    const query = 'SELECT utilizadorAdministrador FROM SERVICOSDB.Credenciais WHERE credenciaisID = @adminID';
    const result = await pool.request().input('adminID', adminID).query(query);
    if (result.recordset.length > 0 && result.recordset[0].utilizadorAdministrador) {
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
router.post('/new', verifyAdmin, async (req, res) => {
  const { nomeMedicamento, tipoID, descricao } = req.body;

  if (!nomeMedicamento || !tipoID || !descricao) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  const query = `
    INSERT INTO SERVICOSDB.Medicamento (nomeMedicamento, tipoID, descricao)
    VALUES (@nomeMedicamento, @tipoID, @descricao)
    OUTPUT INSERTED.*
  `;

  try {
    const results = await executeQuery(query, { nomeMedicamento, tipoID, descricao });
    res.status(201).json({ message: 'Medicamento criado com sucesso.', medicamento: results[0] });
  } catch (error) {
    console.error('Erro ao adicionar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// READ
// Route to list all medications
router.get('/all', async (req, res) => {
  const query = `
    SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
    FROM SERVICOSDB.Medicamento m
    JOIN SERVICOSDB.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    JOIN SERVICOSDB.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
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
    FROM SERVICOSDB.Medicamento m
    JOIN SERVICOSDB.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    JOIN SERVICOSDB.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
    WHERE m.nomeMedicamento LIKE @query
  `;

  try {
    const results = await executeQuery(sqlQuery, { query: `%${query}%` });
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
router.put('/update/:medicamentoID', async (req, res) => {
  const { medicamentoID } = req.params;
  const { nomeMedicamento, tipoID, descricao } = req.body;

  if (!nomeMedicamento || !tipoID || !descricao) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  const query = `
    UPDATE SERVICOSDB.Medicamento
    SET nomeMedicamento = @nomeMedicamento, tipoID = @tipoID, descricao = @descricao
    WHERE medicamentoID = @medicamentoID
    OUTPUT INSERTED.*
  `;

  try {
    const results = await executeQuery(query, { nomeMedicamento, tipoID, descricao, medicamentoID });
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
router.delete('/delete/:medicamentoID', verifyAdmin, async (req, res) => {
  const { medicamentoID } = req.params;

  const query = `
    DELETE FROM SERVICOSDB.Medicamento
    WHERE medicamentoID = @medicamentoID
    OUTPUT DELETED.*
  `;

  try {
    const results = await executeQuery(query, { medicamentoID });
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
