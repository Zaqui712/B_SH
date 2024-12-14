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

    // Log the fetched user object to verify the field name
    console.log('Fetched User:', user);

    // Validate credentials
    if (!user || user.password !== password) {
      return res.status(400).send('Invalid credentials');
    }

    // Ensure we're correctly using the correct field for isAdmin
    console.log('User is Admin:', user.utilizadoradministrador);

    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.credenciaisid, 
        isAdmin: user.utilizadoradministrador // Correctly pass utilizadoradministrador as isAdmin
      },
      process.env.JWT_SECRET || 'secret', // Use env variable for production
      { expiresIn: '1h' }
    );

    // Log the generated token
    console.log('Generated Token:', token);

    // Send token as a response
    res.json({ token });
  } catch (error) {
    res.status(500).send('Internal server error');
    console.error(error); // Log errors for debugging
  }
});



module.exports = router;
