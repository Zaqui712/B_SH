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
    const query = 'SELECT utilizadorAdministrador FROM SERVICOSDB.dbo.Credenciais WHERE credenciaisID = @adminID';
    const result = await pool.request().input('adminID', adminID).query(query);
    if (result.recordset.length > 0 && result.recordset[0].utilizadorAdministrador) {
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
  const { estadoID, adminID, fornecedorID, profissionalID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada, medicamentos } = req.body;
  try {
    if (!estadoID || !adminID || !fornecedorID || !profissionalID || aprovadoPorAdministrador === undefined || encomendaCompleta === undefined || !dataEncomenda || !medicamentos || medicamentos.length === 0) {
      throw new Error('All fields are required');
    }

    const pool = await getPool();
    const createOrderQuery = `
      INSERT INTO SERVICOSDB.dbo.Encomenda (estadoID, adminID, fornecedorID, profissionalID, aprovadoPorAdministrador, encomendaCompleta, dataEncomenda, dataEntrega, quantidadeEnviada)
      VALUES (@estadoID, @adminID, @fornecedorID, @profissionalID, @aprovadoPorAdministrador, @encomendaCompleta, @dataEncomenda, @dataEntrega, @quantidadeEnviada)
      OUTPUT INSERTED.encomendaID
    `;
    const createOrderResult = await pool.request()
      .input('estadoID', estadoID)
      .input('adminID', adminID)
      .input('fornecedorID', fornecedorID)
      .input('profissionalID', profissionalID) // Add profissionalID here
      .input('aprovadoPorAdministrador', aprovadoPorAdministrador)
      .input('encomendaCompleta', encomendaCompleta)
      .input('dataEncomenda', dataEncomenda)
      .input('dataEntrega', dataEntrega)
      .input('quantidadeEnviada', quantidadeEnviada)
      .query(createOrderQuery);
    const newOrderID = createOrderResult.recordset[0].encomendaID;

    // Link medications to the order
    for (const med of medicamentos) {
      const linkMedicationQuery = `
        INSERT INTO SERVICOSDB.dbo.Medicamento_Encomenda (medicamentoID, encomendaID, quantidade)
        VALUES (@medicamentoID, @encomendaID, @quantidade)
      `;
      await pool.request()
        .input('medicamentoID', med.medicamentoID)
        .input('encomendaID', newOrderID)
        .input('quantidade', med.quantidade)
        .query(linkMedicationQuery);
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
    const pool = await getPool();
    const query = `
      SELECT e.*, a.nomeProprio, a.ultimoNome, f.nomeFornecedor, p.nomeProprio AS profissionalNome, p.ultimoNome AS profissionalUltimoNome
      FROM SERVICOSDB.dbo.Encomenda e
      JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
      JOIN SERVICOSDB.dbo.Fornecedor f ON e.fornecedorID = f.fornecedorID
      LEFT JOIN SERVICOSDB.dbo.Profissional_De_Saude p ON e.profissionalID = p.profissionalID
    `;
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Route to list pending approval orders
router.get('/pending-approval', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `
      SELECT e.*, a.nomeProprio, a.ultimoNome, p.nomeProprio AS profissionalNome, p.ultimoNome AS profissionalUltimoNome
      FROM SERVICOSDB.dbo.Encomenda e
      JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
      LEFT JOIN SERVICOSDB.dbo.Profissional_De_Saude p ON e.profissionalID = p.profissionalID
      WHERE e.aprovadoPorAdministrador = 0
    `;
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// UPDATE
// Route to approve an order (only administrators)
router.put('/approve/:encomendaID', verifyAdmin, async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = await getPool();
    const query = `
      UPDATE SERVICOSDB.dbo.Encomenda
      SET aprovadoPorAdministrador = 1
      WHERE encomendaID = @encomendaID
      OUTPUT INSERTED.*
    `;

    const result = await pool.request().input('encomendaID', encomendaID).query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Order not found or already approved.' });
    }

    res.status(200).json({ message: 'Order approved successfully.', encomenda: result.recordset[0] });
  } catch (error) {
    console.error('Error approving order:', error.message);
    res.status(500).send('Error approving order');
  }
});

// Route to approve orders (only administrators)
router.post('/approve', verifyAdmin, async (req, res) => {
  const { encomendaID } = req.body;
  try {
    const pool = await getPool();
    const query = `
      UPDATE SERVICOSDB.dbo.Encomenda
      SET aprovadoPorAdministrador = 1
      WHERE encomendaID = @encomendaID
    `;
    await pool.request().input('encomendaID', encomendaID).query(query);
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
    const pool = await getPool();

    // First, delete any associated Medicamento_Encomenda entries
    const deleteMedicationsQuery = `
      DELETE FROM SERVICOSDB.dbo.Medicamento_Encomenda
      WHERE encomendaID = @encomendaID
    `;
    await pool.request().input('encomendaID', encomendaID).query(deleteMedicationsQuery);

    // Then, delete the order itself
    const deleteOrderQuery = `
      DELETE FROM SERVICOSDB.dbo.Encomenda
      WHERE encomendaID = @encomendaID
      OUTPUT DELETED.*
    `;
    const result = await pool.request().input('encomendaID', encomendaID).query(deleteOrderQuery);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.status(200).json({ message: 'Order deleted successfully.', encomenda: result.recordset[0] });
  } catch (error) {
    console.error('Error deleting order:', error.message);
    res.status(500).send('Error deleting order');
  }
});

module.exports = router;
