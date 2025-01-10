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
    SELECT e.*, a.nomeProprio, a.ultimoNome
    FROM SERVICOSDB.dbo.Encomenda e
    JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
    WHERE e.aprovadoPorAdministrador = 0;
  `;

  const pendingRequestsQuery = `
    SELECT req.*, pro.nomeProprio, pro.ultimoNome 
    FROM SERVICOSDB.dbo.Requisicao req
    JOIN SERVICOSDB.dbo.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
    WHERE req.aprovadoPorAdministrador = 0;
  `;

  try {
    // Execute all queries concurrently
    const [medicationsResults, ordersResults, requestsResults] = await Promise.all([
      pool.request().query(checkMedicationsQuery),
      pool.request().query(pendingOrdersQuery),
      pool.request().query(pendingRequestsQuery),
    ]);

    // Prepare the response
    const response = {
      medications: medicationsResults.recordset.length > 0 
        ? medicationsResults.recordset 
        : 'All medications are above the minimum quantity.',
      
      orders: ordersResults.recordset.length > 0 
        ? ordersResults.recordset 
        : 'No pending approval orders.',
      
      requests: requestsResults.recordset.length > 0 
        ? requestsResults.recordset 
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
