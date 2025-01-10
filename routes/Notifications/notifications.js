const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db');

// Enable CORS for all origins
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

const Alerts = async (req, res) => {
  const pool = await getPool();

  // Queries for alerts
  const checkMedicationsQuery = `
    SELECT msh.medicamentoID, msh.servicoID, msh.quantidadeDisponivel, msh.quantidadeMinima,
           m.nomeMedicamento, m.tipoMedicamento
    FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh
    JOIN SERVICOSDB.dbo.Medicamento m ON msh.medicamentoID = m.medicamentoID
    WHERE msh.quantidadeDisponivel < msh.quantidadeMinima;
  `;

  const pendingOrdersQuery = `
    SELECT e.encomendaID, e.dataEncomenda, e.aprovadoPorAdministrador, e.quantidadeEnviada, 
           e.estadoID, e.encomendaCompleta, e.dataEntrega,
           a.nomeProprio, a.ultimoNome,
           es.descricao AS estadoDescricao,  -- To include the state description
           f.nomeFornecedor, f.contactoFornecedor
    FROM SERVICOSDB.dbo.Encomenda e
    JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
    JOIN SERVICOSDB.dbo.Estado es ON e.estadoID = es.estadoID  -- Joining Estado to get the state description
    JOIN SERVICOSDB.dbo.Fornecedor f ON e.fornecedorID = f.fornecedorID  -- Joining Fornecedor to get supplier info
    WHERE e.aprovadoPorAdministrador = 0;
  `;

  const pendingRequestsQuery = `
    SELECT req.requisicaoID, req.dataRequisicao, req.aprovadoPorAdministrador, 
           pro.nomeProprio, pro.ultimoNome 
    FROM SERVICOSDB.dbo.Requisicao req
    JOIN SERVICOSDB.dbo.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
    WHERE req.aprovadoPorAdministrador = 0;
  `;

  // Define the incomplete orders query (based on your previous pattern)
  const incompleteOrdersQuery = `
    SELECT e.encomendaID, e.dataEncomenda, e.encomendaCompleta
    FROM SERVICOSDB.dbo.Encomenda e
    WHERE e.encomendaCompleta = 0;  -- This checks for orders that are incomplete
  `;

  try {
    // Execute all queries concurrently
    const [medicationsResults, pendingOrdersResults, incompleteOrdersResults, pendingRequestsResults] = await Promise.all([
      pool.request().query(checkMedicationsQuery),
      pool.request().query(pendingOrdersQuery),
      pool.request().query(incompleteOrdersQuery),
      pool.request().query(pendingRequestsQuery),
    ]);

    // Prepare the response
    const response = {
      medications: medicationsResults.recordset.length > 0 
        ? medicationsResults.recordset 
        : 'All medications are above the minimum quantity.',
      
      pendingOrders: pendingOrdersResults.recordset.length > 0 
        ? pendingOrdersResults.recordset 
        : 'No pending approval orders.',
      
      incompleteOrders: incompleteOrdersResults.recordset.length > 0 
        ? incompleteOrdersResults.recordset 
        : 'All orders are marked as complete.',
      
      requests: pendingRequestsResults.recordset.length > 0 
        ? pendingRequestsResults.recordset 
        : 'No pending approval requests.',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error checking alerts:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Route configuration
router.get('/', Alerts);

module.exports = router;
