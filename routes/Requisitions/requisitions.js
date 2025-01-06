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
    const pool = getPool();
    const query = 'SELECT utilizadorAdministrador FROM servicosBD.Credenciais WHERE credenciaisID = $1';
    const result = await pool.query(query, [adminID]);
    if (result.rows.length > 0 && result.rows[0].utilizadoradministrador) {
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
router.post('/create', async (req, res) => {
  const { estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega } = req.body;
  try {
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO servicosBD.Requisicao (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega]
    );
    res.status(201).send('Request created successfully');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// READ
// Route to list all requests (GET /api/request/)
router.get('/all', async (req, res) => {
  try {
    const pool = getPool();
    const query = `SELECT * FROM servicosBD.Requisicao`; // Fetch all requests
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      res.status(200).json(result.rows);
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
    const pool = getPool();
    const query = `
      SELECT req.*, pro.nomeProprio, pro.ultimoNome 
      FROM servicosBD.Requisicao req
      JOIN servicosBD.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
      WHERE req.aprovadoPorAdministrador = false
    `;
    const result = await pool.query(query);

    if (result.rows.length > 0) {
      console.log('Pending approval requests:');
      result.rows.forEach((row) => {
        console.log(`- ID: ${row.requisicaoid}, Name: ${row.nomeProprio} ${row.ultimoNome}, Request Date: ${row.dataRequisicao}`);
      });
      res.status(200).json(result.rows);
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
    const pool = getPool();
    const result = await pool.query(
      `SELECT req.*, pro.nomeProprio, pro.ultimoNome 
       FROM servicosBD.Requisicao req
       JOIN servicosBD.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
       WHERE pro.servicoID = $1`,
      [servicoID]
    );
    res.json(result.rows);
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
    const pool = getPool();
    const query = `
      UPDATE servicosBD.Requisicao
      SET aprovadoPorAdministrador = true
      WHERE requisicaoID = $1
      RETURNING *
    `;

    const result = await pool.query(query, [requestID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Request not found or already approved.' });
    }

    res.status(200).json({ message: 'Request approved successfully.', request: result.rows[0] });
  } catch (error) {
    console.error('Error approving request:', error.message);
    res.status(500).send('Error approving request');
  }
});

// DELETE
// Route to delete a request (DELETE /api/request/requests/:requestID)
router.delete('/:requestID', async (req, res) => {
  const { requestID } = req.params;

  try {
    const pool = getPool();

    // Delete the request
    const deleteRequestQuery = `
      DELETE FROM servicosBD.Requisicao
      WHERE requisicaoID = $1
      RETURNING *
    `;
    const result = await pool.query(deleteRequestQuery, [requestID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    res.status(200).json({ message: 'Request deleted successfully.', request: result.rows[0] });
  } catch (error) {
    console.error('Error deleting request:', error.message);
    res.status(500).send('Error deleting request');
  }
});

// Additional route to approve orders (only administrators)
router.post('/approve-order', verifyAdmin, async (req, res) => {
  const { encomendaID } = req.body;
  try {
    const pool = getPool();
    const query = `
      UPDATE servicosBD.Encomenda
      SET aprovadoPorAdministrador = true
      WHERE encomendaID = $1
    `;
    await pool.query(query, [encomendaID]);
    res.status(200).send('Order approved successfully');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

module.exports = router;
