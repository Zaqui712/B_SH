const express = require('express'); 
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Enable CORS for all origins
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Alerts handler function
const Alerts = async (req, res) => {
  const pool = await getPool();

  // Query for checking medication quantities
  const checkMedicationsQuery = `
    SELECT msh.medicamentoid, msh.servicoid, msh.quantidadedisponivel, msh.quantidademinima,
           m.nomeMedicamento, tm.descricao
    FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh
    JOIN SERVICOSDB.dbo.Medicamento m ON msh.medicamentoid = m.medicamentoid
    JOIN SERVICOSDB.dbo.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
    WHERE msh.quantidadedisponivel < msh.quantidademinima;
  `;

  // Query for listing pending orders
  const pendingOrdersQuery = `
    SELECT e.*, a.nomeProprio, a.ultimoNome
    FROM SERVICOSDB.dbo.Encomenda e
    JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
    WHERE e.aprovadoPorAdministrador = 0;
  `;

  // Query for listing pending requests for approval
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
      pool.request().query(pendingRequestsQuery)
    ]);

    // Check medication quantities
    const medications = medicationsResults.recordset;
    if (medications.length > 0) {
      console.log('Medications below minimum quantity:', medications);
    }

    // Check pending orders
    const orders = ordersResults.recordset;
    if (orders.length > 0) {
      console.log('Pending approval orders:', orders);
    }

    // Check pending requests
    const requests = requestsResults.recordset;
    if (requests.length > 0) {
      console.log('Pending approval requests:');
      requests.forEach((row) => {
        console.log(`- ID: ${row.requisicaoID}, Name: ${row.nomeProprio} ${row.ultimoNome}, Request Date: ${row.dataRequisicao}`);
      });
    }

    // Prepare the response
    const response = {
      medications: medications.length > 0 ? medications : 'All medications are above the minimum quantity.',
      orders: orders.length > 0 ? orders : 'No pending approval orders.',
      requests: requests.length > 0 ? requests : 'No pending approval requests.'
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error checking alerts:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Note the path used here: '/'
router.get('/', Alerts);

module.exports = router;
