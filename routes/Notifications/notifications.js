const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db');

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

router.use(cors(corsOptions));

const Alerts = async (req, res) => {
  const pool = await getPool();

  const checkMedicationsQuery = `
    SELECT msh.medicamentoID, msh.servicoID, msh.quantidadeDisponivel, msh.quantidadeMinima,
           m.nomeMedicamento, m.tipoMedicamento
    FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh
    JOIN SERVICOSDB.dbo.Medicamento m ON msh.medicamentoID = m.medicamentoID
    WHERE msh.quantidadeDisponivel < msh.quantidadeMinima;
  `;

  const pendingOrdersQuery = `
    SELECT enc.encomendaID,  enc.estadoID,  enc.dataEncomenda,  enc.quantidadeEnviada,  enc.profissionalID,
	pro.nomeProprio, pro.ultimoNome 
	FROM Encomenda enc
	JOIN Profissional_De_Saude pro ON enc.profissionalID = pro.profissionalID
	WHERE enc.aprovadoPorAdministrador IS NULL
  `;

  const pendingRequestsQuery = `
    SELECT req.requisicaoID, req.dataRequisicao, req.aprovadoPorAdministrador, 
           pro.nomeProprio, pro.ultimoNome 
    FROM SERVICOSDB.dbo.Requisicao req
    JOIN SERVICOSDB.dbo.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
    WHERE req.aprovadoPorAdministrador = 0;
  `;

  const incompleteOrdersQuery = `
    SELECT enc.encomendaID,  enc.estadoID,  enc.dataEncomenda,  enc.quantidadeEnviada,  enc.profissionalID,
	pro.nomeProprio, pro.ultimoNome 
	FROM Encomenda enc
	JOIN Profissional_De_Saude pro ON enc.profissionalID = pro.profissionalID
	WHERE enc.encomendaCompleta IS NULL OR enc.encomendaCompleta = 0
  `;

  try {
    const [medicationsResults, pendingOrdersResults, incompleteOrdersResults, pendingRequestsResults] = await Promise.all([
      pool.request().query(checkMedicationsQuery),
      pool.request().query(pendingOrdersQuery),
      pool.request().query(incompleteOrdersQuery),
      pool.request().query(pendingRequestsQuery),
    ]);

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

router.get('/', Alerts);

module.exports = router;
