const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { executeQuery } = require('../../db'); // Database connection pool

// Enable CORS for all origins
router.use(cors({
  origin: '*', // Allow all origins (you can restrict this to specific domains in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// READ
// Route to check the entire inventory stock
router.get('/inventory', async (req, res) => {
  const query = `
    SELECT m.medicamentoid, m.nomeMedicamento, tm.descricao, msh.quantidadedisponivel
    FROM SERVICOSDB.dbo.Medicamento m
    JOIN SERVICOSDB.dbo.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    JOIN SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
    WHERE msh.quantidadedisponivel > 0
  `;
  try {
    const results = await executeQuery(query);
    res.status(200).json(results.recordset);
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
    FROM SERVICOSDB.dbo.Medicamento m
    JOIN SERVICOSDB.dbo.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    JOIN SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
    WHERE msh.medicamentoid = @medicamentoID AND msh.servicoid = @servicoID
  `;
  try {
    const results = await executeQuery(query, { medicamentoID, servicoID });
    if (results.recordset.length > 0) {
      res.status(200).json(results.recordset[0]);
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
router.put('/add', async (req, res) => {
  const { medicamentoID, servicoID, quantidadeAdicionar } = req.body;

  if (!medicamentoID || !servicoID || quantidadeAdicionar === undefined) {
    return res.status(400).json({ message: 'IDs do medicamento e serviço, e quantidade a adicionar são obrigatórios.' });
  }

  const query = `
    UPDATE SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
    SET quantidadedisponivel = quantidadedisponivel + @quantidadeAdicionar
    WHERE medicamentoID = @medicamentoID AND servicoID = @servicoID
    OUTPUT INSERTED.*
  `;
  try {
    const results = await executeQuery(query, { quantidadeAdicionar, medicamentoID, servicoID });
    if (results.recordset.length > 0) {
      res.status(200).json({ message: 'Estoque atualizado com sucesso.', estoque: results.recordset[0] });
    } else {
      res.status(404).json({ message: 'Medicamento ou serviço não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao adicionar valores ao estoque:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Route to delete values from the stock
router.put('/remove', async (req, res) => {
  const { medicamentoID, servicoID, quantidadeRemover } = req.body;

  if (!medicamentoID || !servicoID || quantidadeRemover === undefined) {
    return res.status(400).json({ message: 'IDs do medicamento e serviço, e quantidade a remover são obrigatórios.' });
  }

  const query = `
    UPDATE SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
    SET quantidadedisponivel = quantidadedisponivel - @quantidadeRemover
    WHERE medicamentoID = @medicamentoID AND servicoID = @servicoID AND quantidadedisponivel >= @quantidadeRemover
    OUTPUT INSERTED.*
  `;
  try {
    const results = await executeQuery(query, { quantidadeRemover, medicamentoID, servicoID });
    if (results.recordset.length > 0) {
      res.status(200).json({ message: 'Estoque atualizado com sucesso.', estoque: results.recordset[0] });
    } else {
      res.status(400).json({ message: 'Estoque insuficiente ou medicamento/serviço não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao remover valores do estoque:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
