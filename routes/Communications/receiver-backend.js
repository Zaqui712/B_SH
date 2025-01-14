const express = require('express');
const { getPool } = require('../../db'); // Assuming you have a function to interact with the database
const axios = require('axios');
const sql = require('mssql'); // Assuming you're using SQL Server
const PORT = 5000;

const router = express.Router();

// Middleware to parse incoming JSON data
router.use(express.json());

// Endpoint to receive orders from sender backend
router.post('/', async (req, res) => {
  try {
    const encomenda = req.body.encomenda; // The encomenda sent by the sender backend

    if (!encomenda || !encomenda.encomendaID) {
      return res.status(400).json({ message: 'Invalid encomenda data' });
    }

    const pool = await getPool();

    // Fetch the existing encomenda data from your database
    const existingEncomendaQuery = `SELECT * FROM Encomendas WHERE encomendaID = @encomendaID`;
    const existingEncomendaResult = await pool.request()
      .input('encomendaID', encomenda.encomendaID)
      .query(existingEncomendaQuery);

    // Check if the encomenda exists in the database
    if (existingEncomendaResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Encomenda not found' });
    }

    // If the encomenda exists, update only the encomendaCompleta and dataEntrega columns
    const existingEncomenda = existingEncomendaResult.recordset[0];

    // If the values need to be updated
    const updateQuery = `
      UPDATE Encomendas
      SET encomendaCompleta = @encomendaCompleta,
          dataEntrega = @dataEntrega
      WHERE encomendaID = @encomendaID
    `;

    await pool.request()
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta)  // Update encomendaCompleta
      .input('dataEntrega', sql.Date, encomenda.dataEntrega)              // Update dataEntrega
      .input('encomendaID', sql.Int, encomenda.encomendaID)               // Identify the encomenda by its ID
      .query(updateQuery);

    return res.json({ message: 'Encomenda updated successfully' });
  } catch (error) {
    console.error('Error receiving encomenda:', error.message);
    res.status(500).json({ message: 'Error processing the encomenda', error: error.message });
  }
});

// Export the router
module.exports = router;
