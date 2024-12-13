const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db'); // Adjusted path
const jwt = require('jsonwebtoken');

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:3000', // Frontend URL
  methods: ['POST'], // Allowed methods
  allowedHeaders: ['Content-Type'], // Allowed headers
};

// Apply CORS middleware to this router
router.use(cors(corsOptions));

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM servicosBD.Credenciais WHERE email = $1', [email]);
    const user = result.rows[0];

    // Validate credentials
    if (!user || user.password !== password) {
      return res.status(400).send('Invalid credentials');
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.credenciaisid, isAdmin: user.utilizadorAdministrador },
      process.env.JWT_SECRET || 'secret', // Use env variable for production
      { expiresIn: '1h' }
    );

    // Send token as a response
    res.json({ token });
  } catch (error) {
    res.status(500).send('Internal server error');
    console.error(error); // Log errors for debugging
  }
});

module.exports = router;
