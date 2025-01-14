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
    const pool = await getPool(); // Make sure this is using the correct database connection

    const updateEstadoQuery = `
      UPDATE Encomenda
      SET estadoID = @estadoID
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
// Function to add stock for Medicamento_Servico_Hospitalar
async function addStockToMedicamentoServicoHospitalar(encomendaID) {
  try {
    const pool = await getPool();

    // Fetch the profissionalID from Encomenda
    const encomendaQuery = `SELECT profissionalID FROM Encomenda WHERE encomendaID = @encomendaID`;
    const encomendaResult = await pool.request()
      .input('encomendaID', sql.Int, encomendaID)
      .query(encomendaQuery);

    if (encomendaResult.recordset.length === 0) {
      throw new Error('Encomenda not found');
    }

    const profissionalID = encomendaResult.recordset[0].profissionalID;

    // Get the servicoID for the profissional
    const servicoID = await getServicoIDFromProfissional(profissionalID);

    // Query to get the quantities of Medicamento from Medicamento_Encomenda
    const medicamentoQuery = `
      SELECT me.quantidadeAdicionar, p.medicamentoID
      FROM Medicamento_Encomenda me
      JOIN Medicamento p ON me.medicamentoID = p.medicamentoID
      WHERE me.encomendaID = @encomendaID
    `;

    const medicamentoResult = await pool.request()
      .input('encomendaID', sql.Int, encomendaID)
      .query(medicamentoQuery);

    if (medicamentoResult.recordset.length > 0) {
      // Loop through each medicamento and update the stock in Medicamento_Servico_Hospitalar
      for (const row of medicamentoResult.recordset) {
        const { quantidadeAdicionar, medicamentoID } = row;

        // Update stock in Medicamento_Servico_Hospitalar
        const updateStockQuery = `
          UPDATE Medicamento_Servico_Hospitalar
          SET quantidadeDisponivel = quantidadeDisponivel + @quantidadeAdicionar
          WHERE medicamentoID = @medicamentoID AND servicoID = @servicoID
        `;

        console.log(`Adding stock for medicamentoID: ${medicamentoID}, servicoID: ${servicoID}, quantity: ${quantidadeAdicionar}`);

        await pool.request()
          .input('quantidadeAdicionar', sql.Int, quantidadeAdicionar)
          .input('medicamentoID', sql.Int, medicamentoID)
          .input('servicoID', sql.Int, servicoID)
          .query(updateStockQuery);
      }

      console.log('Stock updated in Medicamento_Servico_Hospitalar');
    } else {
      throw new Error('No medicamento found for encomendaID: ' + encomendaID);
    }

  } catch (error) {
    console.error('Error adding stock to Medicamento_Servico_Hospitalar:', error.message);
    throw new Error('Failed to add stock to Medicamento_Servico_Hospitalar');
  }
}

// Function to get the servicoID from Profissional_De_Saude
async function getServicoIDFromProfissional(profissionalID) {
  try {
    const pool = await getPool();

    // Query to fetch servicoID for the given profissionalID
    const query = `SELECT servicoID FROM Profissional_De_Saude WHERE profissionalID = @profissionalID`;

    const result = await pool.request()
      .input('profissionalID', sql.Int, profissionalID)
      .query(query);

    if (result.recordset.length === 0) {
      throw new Error('Profissional not found');
    }

    return result.recordset[0].servicoID; // Return the servicoID
  } catch (error) {
    console.error('Error getting servicoID:', error.message);
    throw new Error('Failed to get servicoID');
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
