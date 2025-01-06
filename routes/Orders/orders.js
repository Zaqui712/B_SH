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
      res.status(403).send('Access denied. Only administrators can approve orders.');
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
};

// CREATE
// Route to create a manual order
router.post('/create', async (req, res) => {
  const { estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada, medicamentos } = req.body;
  try {
    if (!estadoID || !adminID || !fornecedorID || aprovadoPorAdministrador === undefined || encomendaCompleta === undefined || !dataEncomenda || !medicamentos || medicamentos.length === 0) {
      throw new Error('All fields are required');
    }

    const pool = getPool();
    const createOrderQuery = `
      INSERT INTO servicosBD.Encomenda (estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING encomendaID
    `;
    const createOrderResult = await pool.query(createOrderQuery, [estadoID, adminID, fornecedorID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada]);
    const newOrderID = createOrderResult.rows[0].encomendaid;

    // Link medications to the order
    for (const med of medicamentos) {
      const linkMedicationQuery = `
        INSERT INTO servicosBD.Medicamento_Encomenda (medicamentoID, encomendaID, quantidade)
        VALUES ($1, $2, $3)
      `;
      await pool.query(linkMedicationQuery, [med.medicamentoID, newOrderID, med.quantidade]);
    }

    res.status(201).send('Order created successfully');
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// READ
// Route to list all orders
router.get('/all', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT e.*, a.nomeProprio, a.ultimoNome, f.nomeFornecedor
      FROM servicosBD.Encomenda e
      JOIN servicosBD.Administrador a ON e.adminID = a.adminID
      JOIN servicosBD.Fornecedor f ON e.fornecedorID = f.fornecedorID
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Route to list pending approval orders
router.get('/pending-approval', async (req, res) => {
  try {
    const pool = getPool();
    const query = `
      SELECT e.*, a.nomeProprio, a.ultimoNome
      FROM servicosBD.Encomenda e
      JOIN servicosBD.Administrador a ON e.adminID = a.adminID
      WHERE e.aprovadoPorAdministrador = false
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// UPDATE
// Route to approve an order (only administrators)
router.put('/approve/:encomendaID', verifyAdmin, async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = getPool();
    const query = `
      UPDATE servicosBD.Encomenda
      SET aprovadoPorAdministrador = true
      WHERE encomendaID = $1
      RETURNING *
    `;

    const result = await pool.query(query, [encomendaID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Order not found or already approved.' });
    }

    res.status(200).json({ message: 'Order approved successfully.', encomenda: result.rows[0] });
  } catch (error) {
    console.error('Error approving order:', error.message);
    res.status(500).send('Error approving order');
  }
});

// Route to approve orders (only administrators)
router.post('/approve', verifyAdmin, async (req, res) => {
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

// DELETE
// Route to delete an order
router.delete('/orders/:encomendaID', async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = getPool();

    // First, delete any associated Medicamento_Encomenda entries
    const deleteMedicationsQuery = `
      DELETE FROM servicosBD.Medicamento_Encomenda
      WHERE encomendaID = $1
    `;
    await pool.query(deleteMedicationsQuery, [encomendaID]);

    // Then, delete the order itself
    const deleteOrderQuery = `
      DELETE FROM servicosBD.Encomenda
      WHERE encomendaID = $1
      RETURNING *
    `;
    const result = await pool.query(deleteOrderQuery, [encomendaID]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.status(200).json({ message: 'Order deleted successfully.', encomenda: result.rows[0] });
  } catch (error) {
    console.error('Error deleting order:', error.message);
    res.status(500).send('Error deleting order');
  }
});

module.exports = router;
