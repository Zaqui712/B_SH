const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Enable CORS for all origins
const corsOptions = {
  origin: '*', // Allow all origins (you can restrict this to specific domains in production)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

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
      res.status(403).send('Access denied. Only administrators can approve requests.');
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
};

// CREATE
// Route to create a new request (POST /api/request/create)
router.post('/requests/create', async (req, res) => {
  const { estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega } = req.body;
  try {
    const pool = await getPool();
    const query = `
      INSERT INTO SERVICOSDB.Requisicao (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega)
      VALUES (@estadoID, @profissionalID, @adminID, @aprovadoPorAdministrador, @requisicaoCompleta, @dataRequisicao, @dataEntrega)
      OUTPUT INSERTED.*
    `;
    const result = await pool.request()
      .input('estadoID', estadoID)
      .input('profissionalID', profissionalID)
      .input('adminID', adminID)
      .input('aprovadoPorAdministrador', aprovadoPorAdministrador)
      .input('requisicaoCompleta', requisicaoCompleta)
      .input('dataRequisicao', dataRequisicao)
      .input('dataEntrega', dataEntrega)
      .query(query);
    res.status(201).send('Request created successfully');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// READ
// Route to list all requests (GET /api/request/)
router.get('/requests/', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `SELECT * FROM SERVICOSDB.Requisicao`; // Fetch all requests
    const result = await pool.request().query(query);

    if (result.recordset.length > 0) {
      res.status(200).json(result.recordset);
    } else {
      res.status(200).json({ message: 'No requests found.' });
    }
  } catch (error) {
    console.error('Error listing requests:', error.message);
    res.status(500).send('Error listing requests');
  }
});

// Route to list pending approval requests (GET /api/request/pending-approval)
router.get('/pending-approval', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `
      SELECT req.*, pro.nomeProprio, pro.ultimoNome 
      FROM SERVICOSDB.Requisicao req
      JOIN SERVICOSDB.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
      WHERE req.aprovadoPorAdministrador = 0
    `;
    const result = await pool.request().query(query);

    if (result.recordset.length > 0) {
      console.log('Pending approval requests:');
      result.recordset.forEach((row) => {
        console.log(`- ID: ${row.requisicaoID}, Name: ${row.nomeProprio} ${row.ultimoNome}, Request Date: ${row.dataRequisicao}`);
      });
      res.status(200).json(result.recordset);
    } else {
      console.log('No pending approval requests.');
      res.status(200).json({ message: 'No pending approval requests.' });
    }
  } catch (error) {
    console.error('Error checking pending requests:', error.message);
    res.status(500).send('Error checking pending requests');
  }
});

// Route to list all requests from a specific health unit (GET /api/request/list/:servicoID)
router.get('/list/:servicoID', async (req, res) => {
  const { servicoID } = req.params;
  try {
    const pool = await getPool();
    const query = `
      SELECT req.*, pro.nomeProprio, pro.ultimoNome 
      FROM SERVICOSDB.Requisicao req
      JOIN SERVICOSDB.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
      WHERE pro.servicoID = @servicoID
    `;
    const result = await pool.request().input('servicoID', servicoID).query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).send(error.message);
  }
});

// UPDATE
// Route to approve a request (PUT /api/request/approve/:requestID) - Only administrators
router.put('/approve/:requestID', verifyAdmin, async (req, res) => {
  const { requestID } = req.params;

  try {
    const pool = await getPool();
    const query = `
      UPDATE SERVICOSDB.Requisicao
      SET aprovadoPorAdministrador = 1
      WHERE requisicaoID = @requestID
      OUTPUT INSERTED.*
    `;

    const result = await pool.request().input('requestID', requestID).query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Request not found or already approved.' });
    }

    res.status(200).json({ message: 'Request approved successfully.', request: result.recordset[0] });
  } catch (error) {
    console.error('Error approving request:', error.message);
    res.status(500).send('Error approving request');
  }
});

// DELETE
// Route to delete a request (DELETE /api/request/requests/:requestID)
router.delete('/requests/:requestID', async (req, res) => {
  const { requestID } = req.params;

  try {
    const pool = await getPool();

    // Delete the request
    const deleteRequestQuery = `
      DELETE FROM SERVICOSDB.Requisicao
      WHERE requisicaoID = @requestID
      OUTPUT DELETED.*
    `;
    const result = await pool.request().input('requestID', requestID).query(deleteRequestQuery);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    res.status(200).json({ message: 'Request deleted successfully.', request: result.recordset[0] });
  } catch (error) {
    console.error('Error deleting request:', error.message);
    res.status(500).send('Error deleting request');
  }
});

// Additional route to approve orders (only administrators)
router.post('/approve-order', verifyAdmin, async (req, res) => {
  const { encomendaID } = req.body;
  try {
    const pool = await getPool();
    const query = `
      UPDATE SERVICOSDB.Encomenda
      SET aprovadoPorAdministrador = 1
      WHERE encomendaID = @encomendaID
    `;
    await pool.request().input('encomendaID', encomendaID).query(query);
    res.status(200).send('Order approved successfully');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

module.exports = router;
