const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path
const jwt = require('jsonwebtoken');

// Enable CORS for all origins
const corsOptions = {
  origin: '*', // Allow all origins (you can restrict this to specific domains in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  const { adminID } = req.body;
  try {
    const pool = await getPool();
    const query = 'SELECT utilizadorAdministrador FROM SERVICOSDB.dbo.Credenciais WHERE credenciaisID = @adminID';
    const result = await pool.request().input('adminID', adminID).query(query);

    if (result.recordset.length > 0 && result.recordset[0].utilizadorAdministrador) {
      next();
    } else {
      res.status(403).send('Access denied. Only administrators can approve requests.');
    }
  } catch (error) {
    console.error('Error verifying admin:', error.message);
    res.status(400).send(error.message);
  }
};

//CREATE

//READ
// Endpoint to get services with positive stock for a given medicamentoID
router.get('/:medicamentoID/servicos', async (req, res) => {
  const { medicamentoID } = req.params; // Extract medicamentoID from URL parameter

  try {
    const pool = await getPool();
    // Query to get servicos with positive stock for the given medicamentoID
    const query = `
      SELECT s.servicoID, s.nomeServico
      FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh
      JOIN SERVICOSDB.dbo.Servico_Hospitalar s
        ON msh.servicoID = s.servicoID
      WHERE msh.medicamentoID = @medicamentoID
        AND msh.quantidadeDisponivel > 0
    `;
    
    const result = await pool.request().input('medicamentoID', medicamentoID).query(query);

    if (result.recordset.length > 0) {
      // Return the list of services with positive stock
      res.status(200).json(result.recordset);
    } else {
      // No services found with positive stock
      res.status(404).send('No services with positive stock found for the given medicamentoID.');
    }
  } catch (error) {
    console.error('Error fetching services:', error.message);
    res.status(500).send('Internal server error');
  }
});

//UPDATE

//DELETE

module.exports = router;
