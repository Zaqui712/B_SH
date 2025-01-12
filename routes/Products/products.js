const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db');
const jwt = require('jsonwebtoken');

// Enable CORS for all origins
const corsOptions = {
  origin: '*', // Allow all origins (adjust for production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];  // Extract JWT token from Authorization header

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');  // Verify token using the secret
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { userID, isAdmin } = decoded;  // Get userID and isAdmin from decoded token

  // Check if the user has admin privileges
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Only admin can access this resource' });
  }

  // Now we use the 'Administrador' table to check if the user is an admin
  try {
    const pool = await getPool();
    const query = `
      SELECT a.adminID, c.utilizadorAdministrador 
      FROM dbo.Administrador a
      JOIN dbo.Credenciais c ON a.credenciaisID = c.credenciaisID
      WHERE a.adminID = @userID AND c.utilizadorAdministrador = 1`;  // Ensure this matches the schema and fields

    const result = await pool.request().input('userID', userID).query(query);

    // If the user is not found or not an admin
    if (result.recordset.length === 0) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized as an admin' });
    }

    // If everything is okay, proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Error fetching admin status:', error.message);
    
    // Additional handling for SQL errors or connection issues
    if (error.code === 'ESOCKET') {
      return res.status(500).json({ error: 'Database connection failed. Please try again later.' });
    }
    
    // General error
    return res.status(500).json({ error: 'Error fetching admin status', details: error.message });
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
    const pool = await getPool();
    await pool.request()
      .input('nomeMedicamento', nomeMedicamento)
      .input('tipoMedicamento', tipoMedicamento)
      .input('dataValidade', dataValidade)
      .input('lote', lote)
      .query(query);

    res.status(201).json({ message: 'Medicamento criado com sucesso.' });
  } catch (error) {
    console.error('Erro ao adicionar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// READ
// Route to list all medications and list their global stock
router.get('/all', async (req, res) => {
  const query = `
    SELECT 
      m.medicamentoID, 
      m.nomeMedicamento, 
      m.tipoMedicamento, 
      m.dataValidade, 
      m.lote,
      COALESCE(SUM(msh.quantidadeDisponivel), 0) AS stockGlobal
    FROM 
      SERVICOSDB.dbo.Medicamento m
    LEFT JOIN 
      SERVICOSDB.dbo.Medicamento_Servico_Hospitalar msh ON m.medicamentoID = msh.medicamentoID
    GROUP BY 
      m.medicamentoID, m.nomeMedicamento, m.tipoMedicamento, m.dataValidade, m.lote;
  `;

  try {
    const pool = await getPool();
    const result = await pool.request().query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error listing medications:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// Route to list all medications
router.get('/allmedicamentoslist', async (req, res) => {
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
    const pool = await getPool();
    const result = await pool.request().input('query', `%${query}%`).query(sqlQuery);
    if (result.recordset.length > 0) {
      res.status(200).json(result.recordset);
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

  // Check if all required fields are provided
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
    // Get the database connection pool
    const pool = await getPool();

    // Execute the query with parameters
    const result = await pool.request()
      .input('nomeMedicamento', nomeMedicamento)
      .input('tipoMedicamento', tipoMedicamento)
      .input('dataValidade', dataValidade)
      .input('lote', lote)
      .input('medicamentoID', medicamentoID)
      .query(query);

    // Check if any rows were affected (meaning the medication was updated)
    if (result.rowsAffected[0] > 0) {
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
    // Use getPool to interact with the database
    const pool = await getPool();
    const checkResults = await pool.request().input('medicamentoID', medicamentoID).query(checkQuery);

    if (checkResults.recordset.length === 0) {
      return res.status(404).json({ message: 'Medicamento não encontrado.' });
    }

    const deleteQuery = `
      DELETE FROM SERVICOSDB.dbo.Medicamento WHERE medicamentoID = @medicamentoID
    `;

    await pool.request().input('medicamentoID', medicamentoID).query(deleteQuery);
    res.status(200).json({ message: 'Medicamento deletado com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar medicamento:', error.message);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
