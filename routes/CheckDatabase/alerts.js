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

const Alerts = async (req, res) => {
    const pool = getPool();

    // Query for checking medication quantities
    const checkMedicationsQuery = `
        SELECT msh.medicamentoid, msh.servicoid, msh.quantidadedisponivel, msh.quantidademinima,
               m.nomeMedicamento, tm.descricao
        FROM servicosBD.Medicamento_Servico_Hospitalar msh
        JOIN servicosBD.Medicamento m ON msh.medicamentoid = m.medicamentoid
        JOIN servicosBD.Tipo_Medicamento tm ON m.tipoID = tm.tipoID
        WHERE msh.quantidadedisponivel < msh.quantidademinima;
    `;

    // Query for listing pending orders
    const pendingOrdersQuery = `
        SELECT e.*, a.nomeProprio, a.ultimoNome
        FROM servicosBD.Encomenda e
        JOIN servicosBD.Administrador a ON e.adminID = a.adminID
        WHERE e.aprovadoPorAdministrador = false;
    `;

    // Query for listing pending requests for approval
    const pendingRequestsQuery = `
        SELECT req.*, pro.nomeProprio, pro.ultimoNome 
        FROM servicosBD.Requisicao req
        JOIN servicosBD.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
        WHERE req.aprovadoPorAdministrador = false;
    `;

    try {
        // Execute all queries concurrently
        const [medicationsResults, ordersResults, requestsResults] = await Promise.all([
            pool.query(checkMedicationsQuery),
            pool.query(pendingOrdersQuery),
            pool.query(pendingRequestsQuery)
        ]);

        // Check medication quantities
        const medications = medicationsResults.rows;
        if (medications.length > 0) {
            console.log('Medicamentos abaixo da quantidade mínima:', medications);
        }

        // Check pending orders
        const orders = ordersResults.rows;
        if (orders.length > 0) {
            console.log('Encomendas pendentes de aprovação:', orders);
        }

        // Check pending requests
        const requests = requestsResults.rows;
        if (requests.length > 0) {
            console.log('Requisições pendentes de aprovação:');
            requests.forEach((row) => {
                console.log(`- ID: ${row.requisicaoid}, Nome: ${row.nomeProprio} ${row.ultimoNome}, Data Requisição: ${row.dataRequisicao}`);
            });
        }

        // Prepare the response
        const response = {
            medications: medications.length > 0 ? medications : 'Todos os medicamentos estão acima da quantidade mínima.',
            orders: orders.length > 0 ? orders : 'Nenhuma encomenda pendente de aprovação.',
            requests: requests.length > 0 ? requests : 'Nenhuma requisição pendente de aprovação.'
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Erro ao verificar alertas:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Note the path used here: '/'
router.get('/', Alerts);

module.exports = router;
