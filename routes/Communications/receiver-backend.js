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

// Function to update stock
async function updateStock(medicamentoID, servicoID, quantidade) {
  const pool = await getPool();

  // Step 2: Get the current stock of the Medicamento_Servico_Hospitalar for the given medicamentoID and servicoID
  const currentStockQuery = `
    SELECT quantidadeDisponivel FROM Medicamento_Servico_Hospitalar 
    WHERE medicamentoID = @medicamentoID AND servicoID = @servicoID
  `;
  const currentStockResult = await pool.request()
    .input('medicamentoID', sql.Int, medicamentoID)
    .input('servicoID', sql.Int, servicoID)
    .query(currentStockQuery);

  if (currentStockResult.recordset.length === 0) {
    throw new Error('Medicamento not found for the given medicamentoID and servicoID');
  }

  const currentStock = currentStockResult.recordset[0].quantidadeDisponivel;
  console.log(`Current stock for medicamentoID ${medicamentoID} and servicoID ${servicoID}: ${currentStock}`);

  // Step 3: Calculate the new stock (existing stock + new quantity)
  const newStock = currentStock + quantidade;
  console.log(`New stock calculated: ${newStock}`);

  // Step 4: Update the stock in Medicamento_Servico_Hospitalar with the new value
  const updateStockQuery = `
    UPDATE Medicamento_Servico_Hospitalar
    SET quantidadeDisponivel = @newStock
    WHERE medicamentoID = @medicamentoID AND servicoID = @servicoID
  `;

  const updateStockResult = await pool.request()
    .input('newStock', sql.Int, newStock) // New stock after adding quantity
    .input('medicamentoID', sql.Int, medicamentoID) // medicamentoID from encomenda
    .input('servicoID', sql.Int, servicoID) // servicoID from encomenda
    .query(updateStockQuery);

  console.log('Stock updated successfully');
}

// Endpoint to receive orders from sender backend
router.post('/', async (req, res) => {
  try {
    const encomenda = req.body.encomenda; // The encomenda sent by the sender backend
    console.log('Received encomenda:', encomenda); // Log the encomenda object

    if (!encomenda || !encomenda.encomendaSHID || !encomenda.quantidade) {
      return res.status(400).json({ message: 'Invalid encomenda data' });
    }

    // Convert encomendaSHID to encomendaID
    const encomendaID = encomenda.encomendaSHID;
    const quantidade = encomenda.quantidade; // Assuming quantity is passed in the encomenda

    console.log(`Processing encomenda with encomendaID: ${encomendaID} and quantity: ${quantidade}`);

    // Fetch the existing encomenda data from your database using encomendaID
    const pool = await getPool();
    const existingEncomendaQuery = `SELECT * FROM Encomenda WHERE encomendaID = @encomendaID`;
    const existingEncomendaResult = await pool.request()
      .input('encomendaID', encomendaID)  // Use encomendaSHID as encomendaID
      .query(existingEncomendaQuery);

    // Check if the encomenda exists in the database
    if (existingEncomendaResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Encomenda not found' });
    }

    // Get the existing encomenda data
    const existingEncomenda = existingEncomendaResult.recordset[0];
    console.log('Existing encomenda data:', existingEncomenda); // Log existing encomenda data

    // Check if encomenda is already complete (encomendaCompleta = true)
    if (existingEncomenda.encomendaCompleta === true) {
      return res.status(400).json({ message: 'Encomenda is already complete, cannot be updated' });
    }

    // Step 1: Get the medicamentoID and servicoID from the encomenda
    const medicamentoID = encomenda.medicamentoID;
    const servicoID = encomenda.servicoID;
    console.log(`Medicamento ID: ${medicamentoID}, Servico ID: ${servicoID}`);

    // Update the stock (this part is now in a separate function)
    await updateStock(medicamentoID, servicoID, quantidade);

    // Update encomenda table with encomendaCompleta, dataEntrega, and estado
    const updateEncomendaQuery = `
      UPDATE Encomenda
      SET encomendaCompleta = @encomendaCompleta,
          dataEntrega = @dataEntrega,
          estado = @estado
      WHERE encomendaID = @encomendaID
    `;

    const updateEncomendaResult = await pool.request()
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta)  // Update encomendaCompleta
      .input('dataEntrega', sql.Date, encomenda.dataEntrega)              // Update dataEntrega
      .input('estado', sql.Int, 4)                                         // Set estado to 4
      .input('encomendaID', sql.Int, encomendaID)                         // Use encomendaID instead of encomendaSHID
      .query(updateEncomendaQuery);

    console.log('Encomenda updated successfully'); // Log encomenda update success

    return res.json({ message: 'Encomenda updated and stock adjusted successfully' });
  } catch (error) {
    console.error('Error receiving encomenda:', error.message);
    res.status(500).json({ message: 'Error processing the encomenda', error: error.message });
  }
});

// Export the router
module.exports = router;
