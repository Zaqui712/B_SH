const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Database connection pool

// Enable CORS for all origins
router.use(cors({
  origin: '*', // Allow all origins (you can restrict this to specific domains in production)
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

// CREATE
//NA

// READ
// Route to check the entire inventory stock
router.get('/inventory', async (req, res) => {
  const query = `
    SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
    FROM servicosBD.Medicamento m
    JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    JOIN servicosBD.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
    WHERE msh.quantidadedisponivel > 0
  `;
  try {
    const results = await executeQuery(query);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error checking inventory:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Route to check the stock of a specific `medicamento_servico_hospitalares`
router.get('/inventory/:medicamentoID/:servicoID', async (req, res) => {
  const { medicamentoID, servicoID } = req.params;
  const query = `
    SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
    FROM servicosBD.Medicamento m
    JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    JOIN servicosBD.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
    WHERE msh.medicamentoid = $1 AND msh.servicoid = $2
  `;
  try {
    const results = await executeQuery(query, [medicamentoID, servicoID]);
    if (results.length > 0) {
      res.status(200).json(results[0]);
    } else {
      res.status(404).json({ message: 'Medicamento ou serviço não encontrado.' });
    }
  } catch (error) {
    console.error('Error checking specific inventory:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
// Route to add values to the stock
router.put('/estoque/adicionar', async (req, res) => {
  const { medicamentoID, servicoID, quantidadeAdicionar } = req.body;

  if (!medicamentoID || !servicoID || quantidadeAdicionar === undefined) {
    return res.status(400).json({ message: 'IDs do medicamento e serviço, e quantidade a adicionar são obrigatórios.' });
  }

  const query = `
    UPDATE servicosBD.Medicamento_Servico_Hospitalar
    SET quantidadedisponivel = quantidadedisponivel + $1
    WHERE medicamentoID = $2 AND servicoID = $3
    RETURNING *
  `;
  try {
    const results = await executeQuery(query, [quantidadeAdicionar, medicamentoID, servicoID]);
    if (results.length > 0) {
      res.status(200).json({ message: 'Estoque atualizado com sucesso.', estoque: results[0] });
    } else {
      res.status(404).json({ message: 'Medicamento ou serviço não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao adicionar valores ao estoque:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Route to delete values from the stock
router.put('/estoque/remover', async (req, res) => {
  const { medicamentoID, servicoID, quantidadeRemover } = req.body;

  if (!medicamentoID || !servicoID || quantidadeRemover === undefined) {
    return res.status(400).json({ message: 'IDs do medicamento e serviço, e quantidade a remover são obrigatórios.' });
  }

  const query = `
    UPDATE servicosBD.Medicamento_Servico_Hospitalar
    SET quantidadedisponivel = quantidadedisponivel - $1
    WHERE medicamentoID = $2 AND servicoID = $3 AND quantidadedisponivel >= $1
    RETURNING *
  `;
  try {
    const results = await executeQuery(query, [quantidadeRemover, medicamentoID, servicoID]);
    if (results.length > 0) {
      res.status(200).json({ message: 'Estoque atualizado com sucesso.', estoque: results[0] });
    } else {
      res.status(400).json({ message: 'Estoque insuficiente ou medicamento/serviço não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao remover valores do estoque:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
