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
  const { estadoID, fornecedorID, dataEncomenda, dataEntrega, quantidadeEnviada, medicamentos } = req.body;

  // Extract token and validate
const token = req.headers.authorization?.split(' ')[1];
if (!token) {
  return res.status(401).json({ error: 'Unauthorized: No token provided' });
}

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

  // Check if user is admin
  if (decoded.isAdmin) {
    return res.status(403).json({ error: 'Only health professionals can create orders' });
  }

  req.userID = decoded.userID;  // Attach user info for further use
} catch (err) {
  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
}

  const profissionalID = userID; // Use userID as profissionalID

  try {
    const pool = await getPool();
    const transaction = pool.transaction();

    // Check if estadoID exists
    const estadoCheckQuery = 'SELECT COUNT(*) AS estadoCount FROM SERVICOSDB.dbo.Estado WHERE estadoID = @estadoID';
    const estadoCheckResult = await pool.request()
      .input('estadoID', estadoID)
      .query(estadoCheckQuery);

    if (estadoCheckResult.recordset.length === 0 || estadoCheckResult.recordset[0].estadoCount === 0) {
      return res.status(400).json({ error: `estadoID ${estadoID} does not exist in Estado table` });
    }

    // Start transaction
    await transaction.begin();

    // Insert order and return order ID
    const createOrderQuery = `
      INSERT INTO SERVICOSDB.dbo.Encomenda 
      (estadoID, fornecedorID, profissionalID, dataEncomenda, dataEntrega, quantidadeEnviada)
      OUTPUT INSERTED.encomendaID
      VALUES (@estadoID, @fornecedorID, @profissionalID, @dataEncomenda, @dataEntrega, @quantidadeEnviada)
    `;
    const createOrderResult = await transaction.request()
      .input('estadoID', estadoID)
      .input('fornecedorID', fornecedorID)
      .input('profissionalID', profissionalID)
      .input('dataEncomenda', dataEncomenda)
      .input('dataEntrega', dataEntrega || null)
      .input('quantidadeEnviada', quantidadeEnviada)
      .query(createOrderQuery);

    const newOrderID = createOrderResult.recordset[0].encomendaID;

    // Insert medications linked to the order
    if (Array.isArray(medicamentos) && medicamentos.length > 0) {
      for (const med of medicamentos) {
        const { medicamentoID, quantidade } = med;

        if (!medicamentoID || !quantidade) {
          return res.status(400).json({ error: 'Each medication must have an ID and quantity' });
        }

        const linkMedicationQuery = `
          INSERT INTO SERVICOSDB.dbo.Medicamento_Encomenda (medicamentoID, encomendaID, quantidade)
          VALUES (@medicamentoID, @encomendaID, @quantidade)
        `;
        await transaction.request()
          .input('medicamentoID', medicamentoID)
          .input('encomendaID', newOrderID)
          .input('quantidade', quantidade)
          .query(linkMedicationQuery);
      }
    }

    // Commit transaction
    await transaction.commit();

    res.status(201).json({ message: 'Order created successfully', encomendaID: newOrderID });
  } catch (error) {
    // Rollback transaction on error
    if (transaction) await transaction.rollback();
    console.error('Error creating order:', error.message);
    res.status(500).json({ error: 'Error creating order', details: error.message });
  }
});





// READ
// Route to list all orders
router.get('/all', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
  e.encomendaID,
  e.estadoID,
  e.adminID,
  e.fornecedorID,
  e.encomendaCompleta,
  e.aprovadoPorAdministrador,
  e.dataEncomenda,
  e.dataEntrega,
  e.quantidadeEnviada,
  e.profissionalID,
  a.nomeProprio AS adminNome,
  a.ultimoNome AS adminUltimoNome,
  f.nomeFornecedor,
  p.nomeProprio AS profissionalNome,
  p.ultimoNome AS profissionalUltimoNome,
  sh.nomeServico AS servicoNome
FROM 
  SERVICOSDB.dbo.Encomenda e
LEFT JOIN 
  SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
LEFT JOIN 
  SERVICOSDB.dbo.Fornecedor f ON e.fornecedorID = f.fornecedorID
LEFT JOIN 
  SERVICOSDB.dbo.Profissional_De_Saude p ON e.profissionalID = p.profissionalID
LEFT JOIN 
  SERVICOSDB.dbo.Servico_Hospitalar sh ON p.servicoID = sh.servicoID

    `;
    
    console.log('Executing query:', query); // Log the query for debugging
    
    const result = await pool.request().query(query);
    
    if (result.recordset.length === 0) {
      console.log('No records found.');
      res.status(404).json({ message: 'No orders found' });
      return;
    }

    console.log('Query result:', result.recordset); // Log the result for debugging
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching orders:', error.message); // Log the error for debugging
    res.status(400).send({ error: error.message });
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
