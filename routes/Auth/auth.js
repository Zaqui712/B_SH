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

    // Debugging: Log the fetched user to ensure the data is correct
    console.log('Fetched User:', user);

    // Validate credentials
    if (!user || user.password !== password) {
      return res.status(400).send('Invalid credentials');
    }

    // Check if the user is an admin by looking at 'utilizadorAdministrador' field
    const isAdmin = user.utilizadorAdministrador; // Ensure this is being fetched correctly

    // Debugging: Log the admin status
    console.log('User is Admin:', isAdmin);

    // Create JWT token with id and admin status
    const token = jwt.sign(
      { id: user.credenciaisid, isAdmin: isAdmin }, // Pass both id and admin status in the payload
      process.env.JWT_SECRET || 'secret', // Use env variable for production
      { expiresIn: '1h' }
    );

    // Debugging: Log the token (be cautious with this in production)
    console.log('Generated Token:', token);

    // Send token as a response
    res.json({ token });
  } catch (error) {
    res.status(500).send('Internal server error');
    console.error(error); // Log errors for debugging
  }
});

module.exports = router;
