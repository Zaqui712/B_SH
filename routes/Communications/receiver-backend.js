const express = require('express');
const cors = require('cors'); // Import cors package
const { getPool } = require('../../db'); // Assuming you have a function to interact with the database
const axios = require('axios');
const sql = require('mssql');
const PORT = 5000;

const app = express();
const router = express.Router(); // Use router to define routes

// Use cors middleware to allow cross-origin requests
app.use(cors()); // Enable CORS for all routes

// Middleware to parse incoming JSON data
app.use(express.json()); // Use express's built-in JSON parser middleware globally

// Function to update estado of encomenda
async function updateEstado(encomendaID) {
  try {
    const pool = await getPool();

    const updateEstadoQuery = `
      UPDATE Encomenda
      SET estado = @estado
      WHERE encomendaID = @encomendaID
    `;

    await pool.request()
      .input('estado', sql.Int, 4)               // Set estado to 4
      .input('encomendaID', sql.Int, encomendaID) // Use encomendaID to update the correct record
      .query(updateEstadoQuery);
    
    console.log(`Estado updated to 4 for encomendaID: ${encomendaID}`);
  } catch (error) {
    console.error('Error updating estado:', error.message);
    throw new Error('Failed to update estado');
  }
}

// Endpoint to receive orders from sender backend
router.post('/', async (req, res) => {
  try {
    const encomenda = req.body.encomenda; // The encomenda sent by the sender backend

    if (!encomenda || !encomenda.encomendaSHID) {
      return res.status(400).json({ message: 'Invalid encomenda data' });
    }

    // Convert encomendaSHID to encomendaID
    const encomendaID = encomenda.encomendaSHID;

    // Fetch the existing encomenda data from your database using encomendaID
    const pool = await getPool();

    const existingEncomendaQuery = `SELECT * FROM Encomenda WHERE encomendaID = @encomendaID`;
    const existingEncomendaResult = await pool.request()
      .input('encomendaID', encomendaID)  // Use encomendaSHID as encomendaID
      .query(existingEncomendaQuery);

    if (existingEncomendaResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Encomenda not found' });
    }

    // If the values need to be updated
    const updateQuery = `
      UPDATE Encomenda
      SET encomendaCompleta = @encomendaCompleta,
          dataEntrega = @dataEntrega
      WHERE encomendaID = @encomendaID
    `;

    await pool.request()
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta)  // Update encomendaCompleta
      .input('dataEntrega', sql.Date, encomenda.dataEntrega)              // Update dataEntrega
      .input('encomendaID', sql.Int, encomendaID)                         // Use encomendaID instead of encomendaSHID
      .query(updateQuery);

    // Now call the separate async function to update the estado
    await updateEstado(encomendaID); // Update estado to 4

    return res.json({ message: 'Encomenda updated and estado set to 4 successfully' });
  } catch (error) {
    console.error('Error receiving encomenda:', error.message);
    res.status(500).json({ message: 'Error processing the encomenda', error: error.message });
  }
});

// Export the router
module.exports = router;
