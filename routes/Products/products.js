const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db'); // Database connection pool
const jwt = require('jsonwebtoken');

// Enable CORS for the backend
router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// Helper function for database queries
const executeQuery = async (query, params = []) => {
  const pool = await getPool();
  try {
    const result = await pool.request().query(query, params);
    return result.recordset;
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
};

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  // Extract the token from Authorization header
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return res.status(403).send('Access denied. No token provided.');
  }

  try {
    // Decode and verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Check if the user is an admin
    if (decoded.isAdmin) {
      // If admin, pass control to the next middleware/route handler
      req.user = decoded; // Attach decoded user info to request for further use
      next();
    } else {
      return res.status(403).send('Access denied. Only administrators can perform this action.');
    }
  } catch (error) {
    return res.status(400).send('Invalid token.');
  }
};

// Route to check admin status
router.get('/user/admin-status', async (req, res) => {
  const { userID } = req.user; // Assuming userID is available in the request
  try {
    const query = `
      SELECT utilizadorAdministrador 
      FROM SERVICOSDB.dbo.Credenciais 
      WHERE credenciaisID = @userID
    `;
    const result = await executeQuery(query, { userID });
    res.status(200).json({ isAdmin: result[0]?.utilizadorAdministrador || false });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying admin status', error: error.message });
  }
});

// CREATE
// Route to add a new medication
router.post('/new', verifyAdmin, async (req, res) => {
  const { nomeMedicamento, tipoMedicamento, dataValidade, lote } = req.body;

  if (!nomeMedicamento || !tipoMedicamento || !dataValidade || !lote) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  const query = `
    INSERT INTO SERVICOSDB.dbo.Medicamento (nomeMedicamento, tipoMedicamento, dataValidade, lote)
    VALUES (@nomeMedicamento, @tipoMedicamento, @dataValidade, @lote)
  `;

  try {
    await executeQuery(query, { nomeMedicamento, tipoMedicamento, dataValidade, lote });
    res.status(201).json({ message: 'Medicamento criado com sucesso.' });
  } catch (error) {
    console.error('Erro ao adicionar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// READ
// Route to list all medications
router.get('/all', async (req, res) => {
  const query = `
    SELECT medicamentoid, nomeMedicamento, tipoMedicamento, dataValidade, lote
    FROM SERVICOSDB.dbo.Medicamento
  `;
  try {
    const results = await executeQuery(query);
    res.status(200).json(results);
  } catch (error) {
    console.error('Error listing medications:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// Function to search for a product
const searchProduct = async (req, res) => {
  const { query } = req.query; // Capture the query parameter
  if (!query) {
    return res.status(400).json({ message: 'Query parameter is required' });
  }

  const sqlQuery = `
    SELECT m.medicamentoid, m.nomeMedicamento, m.tipoMedicamento, msh.quantidadedisponivel
    FROM SERVICOSDB.dbo.Medicamento m
    JOIN SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh ON msh.medicamentoid = m.medicamentoid
    WHERE m.nomeMedicamento LIKE @query
  `;

  try {
    const results = await executeQuery(sqlQuery, { query: `%${query}%` });
    if (results.length > 0) {
      console.log('Produtos encontrados:', results);
      res.status(200).json(results);
    } else {
      res.status(404).json({ message: 'Nenhum produto encontrado com a consulta fornecida.' });
    }
  } catch (error) {
    console.error('Error searching product:', error.message);
    res.status(500).json({ error: error.message });
  }
};

router.get('/search', searchProduct);

// UPDATE
// Route to update medication information
router.put('/update/:medicamentoID', async (req, res) => {
  const { medicamentoID } = req.params;
  const { nomeMedicamento, tipoMedicamento, dataValidade, lote } = req.body;

  if (!nomeMedicamento || !tipoMedicamento || !dataValidade || !lote) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  const query = `
    UPDATE SERVICOSDB.dbo.Medicamento
    SET nomeMedicamento = @nomeMedicamento, tipoMedicamento = @tipoMedicamento, 
        dataValidade = @dataValidade, lote = @lote
    WHERE medicamentoID = @medicamentoID
  `;

  try {
    const results = await executeQuery(query, { nomeMedicamento, tipoMedicamento, dataValidade, lote, medicamentoID });
    if (results.length > 0) {
      res.status(200).json({ message: 'Medicamento atualizado com sucesso.' });
    } else {
      res.status(404).json({ message: 'Medicamento não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao atualizar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE
// Route to delete a medication
router.delete('/delete/:medicamentoID', verifyAdmin, async (req, res) => {
  const { medicamentoID } = req.params;

  const checkQuery = `
    SELECT * FROM SERVICOSDB.dbo.Medicamento WHERE medicamentoID = @medicamentoID
  `;

  try {
    const checkResults = await executeQuery(checkQuery, { medicamentoID });

    if (checkResults.length === 0) {
      return res.status(404).json({ message: 'Medicamento não encontrado.' });
    }

    const deleteQuery = `
      DELETE FROM SERVICOSDB.dbo.Medicamento WHERE medicamentoID = @medicamentoID
    `;
    
    await executeQuery(deleteQuery, { medicamentoID });
    res.status(200).json({ message: 'Medicamento deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
