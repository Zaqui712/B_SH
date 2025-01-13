const express = require('express');
const { getPool } = require('../../db'); // Assuming you have a function to interact with the database
const axios = require('axios');
const sql = require('mssql'); // Assuming you're using SQL Server

const router = express.Router();
const PORT = 5000;

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
      // If it doesn't exist, insert it as a new order
      const insertQuery = `
        INSERT INTO Encomendas (encomendaID, estadoID, adminID, fornecedorID, encomendaCompleta, aprovadoPorAdministrador, dataEncomenda, dataEntrega, quantidadeEnviada, profissionalID, adminNome, adminUltimoNome, nomeFornecedor, profissionalNome, profissionalUltimoNome, servicoNome)
        VALUES (@encomendaID, @estadoID, @adminID, @fornecedorID, @encomendaCompleta, @aprovadoPorAdministrador, @dataEncomenda, @dataEntrega, @quantidadeEnviada, @profissionalID, @adminNome, @adminUltimoNome, @nomeFornecedor, @profissionalNome, @profissionalUltimoNome, @servicoNome)
      `;
      
      await pool.request()
        .input('encomendaID', encomenda.encomendaID)
        .input('estadoID', encomenda.estadoID)
        .input('adminID', encomenda.adminID)
        .input('fornecedorID', encomenda.fornecedorID)
        .input('encomendaCompleta', encomenda.encomendaCompleta)
        .input('aprovadoPorAdministrador', encomenda.aprovadoPorAdministrador)
        .input('dataEncomenda', encomenda.dataEncomenda)
        .input('dataEntrega', encomenda.dataEntrega)
        .input('quantidadeEnviada', encomenda.quantidadeEnviada)
        .input('profissionalID', encomenda.profissionalID)
        .input('adminNome', encomenda.adminNome)
        .input('adminUltimoNome', encomenda.adminUltimoNome)
        .input('nomeFornecedor', encomenda.nomeFornecedor)
        .input('profissionalNome', encomenda.profissionalNome)
        .input('profissionalUltimoNome', encomenda.profissionalUltimoNome)
        .input('servicoNome', encomenda.servicoNome)
        .query(insertQuery);
      
      // Insert the medications (if any)
      if (encomenda.medicamentos && encomenda.medicamentos.length > 0) {
        for (const medicamento of encomenda.medicamentos) {
          const insertMedicamentoQuery = `
            INSERT INTO Medicamento_Encomenda (encomendaID, medicamentoID, quantidade)
            VALUES (@encomendaID, @medicamentoID, @quantidade)
          `;
          await pool.request()
            .input('encomendaID', encomenda.encomendaID)
            .input('medicamentoID', medicamento.medicamentoID)
            .input('quantidade', medicamento.quantidade)
            .query(insertMedicamentoQuery);
        }
      }

      return res.json({ message: 'Encomenda inserted successfully' });
    } else {
      // If the encomenda exists, compare and update if necessary
      const existingEncomenda = existingEncomendaResult.recordset[0];
      let updateQuery = `UPDATE Encomendas SET `;
      let updateParams = [];

      // Compare each field and update if necessary
      if (existingEncomenda.estadoID !== encomenda.estadoID) {
        updateQuery += `estadoID = @estadoID, `;
        updateParams.push({ name: 'estadoID', value: encomenda.estadoID });
      }

      if (existingEncomenda.quantidadeEnviada !== encomenda.quantidadeEnviada) {
        updateQuery += `quantidadeEnviada = @quantidadeEnviada, `;
        updateParams.push({ name: 'quantidadeEnviada', value: encomenda.quantidadeEnviada });
      }

      // Continue checking other fields...

      // Remove the trailing comma
      updateQuery = updateQuery.slice(0, -2); // Remove last comma

      updateQuery += ` WHERE encomendaID = @encomendaID`;

      // Apply parameters
      const request = pool.request().input('encomendaID', encomenda.encomendaID);
      updateParams.forEach(param => request.input(param.name, param.value));

      await request.query(updateQuery);
      return res.json({ message: 'Encomenda updated successfully' });
    }
  } catch (error) {
    console.error('Error receiving encomenda:', error.message);
    res.status(500).json({ message: 'Error processing the encomenda', error: error.message });
  }
});

// Export the router
module.exports = router;
