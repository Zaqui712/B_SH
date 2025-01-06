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
    const pool = getPool();
    
    // Fetch user credentials
    const credentialsResult = await pool.query(
      'SELECT * FROM servicosBD.Credenciais WHERE email = $1',
      [email]
    );
    const user = credentialsResult.rows[0];

    if (!user || user.password !== password) {
      return res.status(400).send('Invalid credentials');
    }

    // Fetch the name based on user type (Admin or Professional)
    let nameResult;
    if (user.utilizadoradministrador) {
      // Admin user
      nameResult = await pool.query(
        'SELECT nomeProprio, ultimoNome FROM servicosBD.Administrador WHERE credenciaisID = $1',
        [user.credenciaisid]
      );
    } else {
      // Healthcare professional user
      nameResult = await pool.query(
        'SELECT nomeProprio, ultimoNome FROM servicosBD.Profissional_De_Saude WHERE credenciaisID = $1',
        [user.credenciaisid]
      );
    }

    const nameData = nameResult.rows[0];
    if (!nameData) {
      return res.status(400).send('User name not found');
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.credenciaisid, 
        isAdmin: user.utilizadoradministrador, 
        firstName: nameData.nomeproprio,
        lastName: nameData.ultimonome
      },
      process.env.JWT_SECRET || 'secret', // Use env variable for production
      { expiresIn: '1h' }
    );

    // Send token and user name as response
    res.json({ 
      token, 
      firstName: nameData.nomeproprio, 
      lastName: nameData.ultimonome 
    });
  } catch (error) {
    res.status(500).send('Internal server error');
    console.error(error); // Log errors for debugging
  }
});

module.exports = router;
