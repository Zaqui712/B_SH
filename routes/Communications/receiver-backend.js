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

// Function to update estadoID of encomenda
async function updateEstado(encomendaID) {
  try {
    const pool = await getPool();

    const updateEstadoQuery = `
      UPDATE Encomenda
      SET estadoID = @estadoID  // Use estadoID instead of estado
      WHERE encomendaID = @encomendaID
    `;

    // Log the query and parameters for debugging
    console.log(`Running query to update estadoID for encomendaID: ${encomendaID}`);

    const result = await pool.request()
      .input('estadoID', sql.Int, 4)               // Set estadoID to 4
      .input('encomendaID', sql.Int, encomendaID)  // Use encomendaID to update the correct record
      .query(updateEstadoQuery);

    // Log the result to confirm the update
    console.log(`estadoID updated to 4 for encomendaID: ${encomendaID}`);
    console.log(result); // Inspect the result object

  } catch (error) {
    console.error('Error updating estadoID:', error.message);
    throw new Error('Failed to update estadoID');
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

    // Verify the update by querying the Encomenda state
    const verifyEstadoQuery = `SELECT estado FROM Encomenda WHERE encomendaID = @encomendaID`;
    const estadoResult = await pool.request()
      .input('encomendaID', encomendaID)
      .query(verifyEstadoQuery);

    console.log('Estado after update:', estadoResult.recordset[0].estado);

    return res.json({ message: 'Encomenda updated and estado set to 4 successfully' });
  } catch (error) {
    console.error('Error receiving encomenda:', error.message);
    res.status(500).json({ message: 'Error processing the encomenda', error: error.message });
  }
});

// Export the router
module.exports = router;
