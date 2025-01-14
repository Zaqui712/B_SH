const express = require('express');
const cors = require('cors');
const { getPool } = require('../../db');
const sql = require('mssql');
const PORT = 5000;

const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

// Function to update stock
async function updateStock(medicamentoID, servicoID, quantidade) {
  const pool = await getPool();

  try {
    const currentStockQuery = `
      SELECT quantidadeDisponivel FROM Medicamento_Servico_Hospitalar 
      WHERE medicamentoID = @medicamentoID AND servicoID = @servicoID
    `;
    const currentStockResult = await pool.request()
      .input('medicamentoID', sql.Int, medicamentoID)
      .input('servicoID', sql.Int, servicoID)
      .query(currentStockQuery);

    if (currentStockResult.recordset.length === 0) {
      console.error('Medicamento not found for the given medicamentoID and servicoID');
      throw new Error('Medicamento not found');
    }

    const currentStock = currentStockResult.recordset[0].quantidadeDisponivel;
    console.log(`Current stock for medicamentoID ${medicamentoID} and servicoID ${servicoID}: ${currentStock}`);

    const newStock = currentStock + quantidade;
    console.log(`New stock calculated: ${newStock}`);

    const updateStockQuery = `
      UPDATE Medicamento_Servico_Hospitalar
      SET quantidadeDisponivel = @newStock
      WHERE medicamentoID = @medicamentoID AND servicoID = @servicoID
    `;
    await pool.request()
      .input('newStock', sql.Int, newStock)
      .input('medicamentoID', sql.Int, medicamentoID)
      .input('servicoID', sql.Int, servicoID)
      .query(updateStockQuery);

    console.log('Stock updated successfully');
  } catch (err) {
    console.error('Error updating stock:', err.message);
    throw new Error('Error updating stock');
  }
}

// Endpoint to receive orders from sender backend
router.post('/', async (req, res) => {
  try {
    const encomenda = req.body.encomenda;
    
    // Validate encomenda data
    if (!encomenda || !encomenda.encomendaSHID || !encomenda.quantidade || !encomenda.medicamentoID || !encomenda.servicoID) {
      return res.status(400).json({ message: 'Invalid encomenda data' });
    }

    const encomendaID = encomenda.encomendaSHID;
    const quantidade = encomenda.quantidade;

    console.log(`Processing encomenda with encomendaID: ${encomendaID}, quantity: ${quantidade}`);

    const pool = await getPool();
    const existingEncomendaQuery = `SELECT * FROM Encomenda WHERE encomendaID = @encomendaID`;
    const existingEncomendaResult = await pool.request()
      .input('encomendaID', encomendaID)
      .query(existingEncomendaQuery);

    if (existingEncomendaResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Encomenda not found' });
    }

    const existingEncomenda = existingEncomendaResult.recordset[0];
    console.log('Existing encomenda data:', existingEncomenda);

    if (existingEncomenda.encomendaCompleta === true) {
      return res.status(400).json({ message: 'Encomenda is already complete, cannot be updated' });
    }

    const medicamentoID = encomenda.medicamentoID;
    const servicoID = encomenda.servicoID;

    console.log(`Medicamento ID: ${medicamentoID}, Servico ID: ${servicoID}`);

    // Update stock first
    await updateStock(medicamentoID, servicoID, quantidade);

    // Update encomenda data
    const updateEncomendaQuery = `
      UPDATE Encomenda
      SET encomendaCompleta = @encomendaCompleta,
          dataEntrega = @dataEntrega,
          estado = @estado
      WHERE encomendaID = @encomendaID
    `;
    await pool.request()
      .input('encomendaCompleta', sql.Bit, encomenda.encomendaCompleta)
      .input('dataEntrega', sql.Date, encomenda.dataEntrega)
      .input('estado', sql.Int, 4)
      .input('encomendaID', sql.Int, encomendaID)
      .query(updateEncomendaQuery);

    console.log('Encomenda and stock updated successfully');

    return res.json({ message: 'Encomenda updated and stock adjusted successfully' });
  } catch (error) {
    console.error('Error receiving encomenda:', error.message);
    res.status(500).json({ message: 'Error processing the encomenda', error: error.message });
  }
});

module.exports = router;
