const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db'); // Adjusted path
const jwt = require('jsonwebtoken');

// Configure CORS
const corsOptions = {
  origin: '*',
  methods: ['POST'], // Allowed methods
  allowedHeaders: ['Content-Type'], // Allowed headers
};

// Apply CORS middleware to this router
router.use(cors(corsOptions));

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const pool = await getPool();
    
    // Fetch user credentials
    const credentialsResult = await pool.request()
      .input('email', email)
      .query('SELECT * FROM SERVICOSDB.Credenciais WHERE email = @email');
    const user = credentialsResult.recordset[0];

    if (!user || user.password !== password) {
      return res.status(400).send('Invalid credentials');
    }

    // Fetch the name based on user type (Admin or Professional)
    let nameResult;
    if (user.utilizadorAdministrador) {
      // Admin user
      nameResult = await pool.request()
        .input('credenciaisID', user.credenciaisID)
        .query('SELECT nomeProprio, ultimoNome FROM SERVICOSDB.Administrador WHERE credenciaisID = @credenciaisID');
    } else {
      // Healthcare professional user
      nameResult = await pool.request()
        .input('credenciaisID', user.credenciaisID)
        .query('SELECT nomeProprio, ultimoNome FROM SERVICOSDB.Profissional_De_Saude WHERE credenciaisID = @credenciaisID');
    }

    const nameData = nameResult.recordset[0];
    if (!nameData) {
      return res.status(400).send('User name not found');
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.credenciaisID, 
        isAdmin: user.utilizadorAdministrador, 
        firstName: nameData.nomeProprio,
        lastName: nameData.ultimoNome
      },
      process.env.JWT_SECRET || 'secret', // Use env variable for production
      { expiresIn: '1h' }
    );

    // Send token and user name as response
    res.json({ 
      token, 
      firstName: nameData.nomeProprio, 
      lastName: nameData.ultimoNome 
    });
  } catch (error) {
    res.status(500).send('Internal server error');
    console.error(error); // Log errors for debugging
  }
});

module.exports = router;
