const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { getPool } = require('../../db');

const router = express.Router();

// Enable CORS for all origins
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

router.use(cors(corsOptions));

// Middleware to verify token and user roles
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded; // Attach user data to request for later use
    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const verifyAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied: Only administrators can perform this action.' });
  }
  next();
};

// CREATE: Route to create a manual order
router.post('/create', verifyToken, async (req, res) => {
  const { estadoID, fornecedorID, dataEncomenda, dataEntrega, quantidadeEnviada, medicamentos } = req.body;
  const profissionalID = req.user.userID;

  try {
    const pool = await getPool();
    const transaction = pool.transaction();

    // Validate estadoID
    const estadoCheckQuery = 'SELECT COUNT(*) AS estadoCount FROM SERVICOSDB.dbo.Estado WHERE estadoID = @estadoID';
    const estadoCheckResult = await pool.request().input('estadoID', estadoID).query(estadoCheckQuery);

    if (estadoCheckResult.recordset[0].estadoCount === 0) {
      return res.status(400).json({ error: `estadoID ${estadoID} does not exist in Estado table` });
    }

    // Start transaction
    await transaction.begin();

    // Insert order and get new order ID
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
          throw new Error('Each medication must have an ID and quantity');
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
    console.error('Error creating order:', error.message);
    if (transaction) await transaction.rollback();
    res.status(500).json({ error: 'Error creating order', details: error.message });
  }
});

// READ: Route to list all orders (No authentication required)
router.get('/all', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `
      SELECT e.encomendaID, e.estadoID, e.adminID, e.fornecedorID, e.encomendaCompleta,
             e.aprovadoPorAdministrador, e.dataEncomenda, e.dataEntrega, e.quantidadeEnviada,
             e.profissionalID, a.nomeProprio AS adminNome, a.ultimoNome AS adminUltimoNome,
             f.nomeFornecedor, p.nomeProprio AS profissionalNome, p.ultimoNome AS profissionalUltimoNome,
             sh.nomeServico AS servicoNome
      FROM SERVICOSDB.dbo.Encomenda e
      LEFT JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
      LEFT JOIN SERVICOSDB.dbo.Fornecedor f ON e.fornecedorID = f.fornecedorID
      LEFT JOIN SERVICOSDB.dbo.Profissional_De_Saude p ON e.profissionalID = p.profissionalID
      LEFT JOIN SERVICOSDB.dbo.Servico_Hospitalar sh ON p.servicoID = sh.servicoID
    `;
    const result = await pool.request().query(query);
    res.json(result.recordset.length ? result.recordset : { message: 'No orders found' });
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// UPDATE: Approve an order (only administrators)
router.put('/approve/:encomendaID', verifyToken, verifyAdmin, async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = await getPool();
    const query = `
      UPDATE SERVICOSDB.dbo.Encomenda
      SET aprovadoPorAdministrador = 1, estadoID = 3
      WHERE encomendaID = @encomendaID
    `;
    const result = await pool.request()
      .input('encomendaID', encomendaID)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Order approved successfully. State updated to 3.' });
    } else {
      res.json({ message: 'Order not found or already approved.' });
    }
  } catch (error) {
    console.error('Error approving order:', error.message);
    res.status(500).json({ error: 'Error approving order' });
  }
});

//Cancel the Orders:
router.put('/cancel/:encomendaID', verifyToken, verifyAdmin, async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = await getPool();

    // Update the estadoID to 2 and encomendaCompleta to true to mark as canceled/deleted
    const cancelOrderQuery = `
      UPDATE SERVICOSDB.dbo.Encomenda
      SET estadoID = 2, encomendaCompleta = 1
      WHERE encomendaID = @encomendaID
    `;
    const result = await pool.request()
      .input('encomendaID', encomendaID)
      .query(cancelOrderQuery);

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Order canceled successfully. State updated to 2 and encomendaCompleta set to true.' });
    } else {
      res.json({ message: 'Order not found or already canceled.' });
    }
  } catch (error) {
    console.error('Error canceling order:', error.message);
    res.status(500).json({ error: 'Error canceling order' });
  }
});



// DELETE: Delete an order (only administrators)
router.delete('/delete/:encomendaID', verifyToken, verifyAdmin, async (req, res) => {
  const { encomendaID } = req.params;

  try {
    const pool = await getPool();

    // Delete associated medications
    const deleteMedicationsQuery = `
      DELETE FROM SERVICOSDB.dbo.Medicamento_Encomenda
      WHERE encomendaID = @encomendaID
    `;
    await pool.request().input('encomendaID', encomendaID).query(deleteMedicationsQuery);

    // Delete the order
    const deleteOrderQuery = `
      DELETE FROM SERVICOSDB.dbo.Encomenda
      WHERE encomendaID = @encomendaID
    `;
    const result = await pool.request().input('encomendaID', encomendaID).query(deleteOrderQuery);

    if (result.rowsAffected[0] > 0) {
      res.json({ message: 'Order deleted successfully.' });
    } else {
      res.json({ message: 'Order not found.' });
    }
  } catch (error) {
    console.error('Error deleting order:', error.message);
    res.status(500).json({ error: 'Error deleting order' });
  }
});


module.exports = router;
