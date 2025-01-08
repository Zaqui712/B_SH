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
    console.log(`Fetching credentials for email: ${email}`);
    const credentialsResult = await pool.request()
      .input('email', email)
      .query('SELECT * FROM SERVICOSDB.dbo.Credenciais WHERE email = @email');
    
    const user = credentialsResult.recordset[0];
    if (!user) {
      console.log('User not found');
      return res.status(400).send('Invalid credentials');
    }
    
    console.log(`User found: ${user.email}`);

    if (user.password !== password) {
      console.log('Password mismatch');
      return res.status(400).send('Invalid credentials');
    }
    
    console.log('Password matches');

    // Fetch the name and ID based on user type (Admin or Professional)
    let nameResult;
    let userID;
    if (user.utilizadorAdministrador) {
      console.log('User is an admin');
      nameResult = await pool.request()
        .input('credenciaisID', user.credenciaisID)
        .query('SELECT nomeProprio, ultimoNome, adminID FROM SERVICOSDB.dbo.Administrador WHERE credenciaisID = @credenciaisID');
      userID = nameResult.recordset[0].adminID; // adminID for admin
    } else {
      console.log('User is not an admin, assuming professional');
      nameResult = await pool.request()
        .input('credenciaisID', user.credenciaisID)
        .query('SELECT nomeProprio, ultimoNome, profissionalID FROM SERVICOSDB.dbo.Profissional_De_Saude WHERE credenciaisID = @credenciaisID');
      userID = nameResult.recordset[0].profissionalID; // profissionalID for professional
    }

    const nameData = nameResult.recordset[0];
    if (!nameData) {
      console.log('User name not found');
      return res.status(400).send('User name not found');
    }

    console.log(`User name found: ${nameData.nomeProprio} ${nameData.ultimoNome}`);

    // Create JWT token with userID, firstName, lastName, and isAdmin flag
    const token = jwt.sign(
      { 
        id: user.credenciaisID, 
        userID: userID,  // Include profissionalID or adminID
        isAdmin: user.utilizadorAdministrador, 
        firstName: nameData.nomeProprio,
        lastName: nameData.ultimoNome
      },
      process.env.JWT_SECRET || 'secret', // Use env variable for production
      { expiresIn: '1h' }
    );
    
    // Log the created token (it's a good practice to log but avoid doing so in production)
    console.log('JWT Token created:', token);

    // Send token, userID, and user name as response
    res.json({ 
      token, 
      userID,  // Add userID (profissionalID or adminID) in the response
      firstName: nameData.nomeProprio, 
      lastName: nameData.ultimoNome 
    });
  } catch (error) {
    res.status(500).send('Internal server error');
    console.error('Error occurred:', error); // Log errors for debugging
  }
});


module.exports = router;
