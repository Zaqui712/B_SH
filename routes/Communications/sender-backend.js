
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const { getPool } = require('../../db'); // Assuming you are using this to interact with the database

const app = express();

// Example of a task that runs every minute
cron.schedule('* * * * *', async () => {
  try {
    console.log('Running task every minute');
    const pool = await getPool();

    // Query to fetch all orders (encomendas) along with associated medications
    const query = `
      SELECT e.encomendaID, e.estadoID, e.adminID, e.fornecedorID, e.encomendaCompleta,
             e.aprovadoPorAdministrador, e.dataEncomenda, e.dataEntrega, e.quantidadeEnviada,
             e.profissionalID, a.nomeProprio AS adminNome, a.ultimoNome AS adminUltimoNome,
             f.nomeFornecedor, p.nomeProprio AS profissionalNome, p.ultimoNome AS profissionalUltimoNome,
             sh.nomeServico AS servicoNome,
             me.medicamentoID, m.nomeMedicamento, me.quantidade AS medicamentoQuantidade
      FROM SERVICOSDB.dbo.Encomenda e
      LEFT JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
      LEFT JOIN SERVICOSDB.dbo.Fornecedor f ON e.fornecedorID = f.fornecedorID
      LEFT JOIN SERVICOSDB.dbo.Profissional_De_Saude p ON e.profissionalID = p.profissionalID
      LEFT JOIN SERVICOSDB.dbo.Servico_Hospitalar sh ON p.servicoID = sh.servicoID
      LEFT JOIN SERVICOSDB.dbo.Medicamento_Encomenda me ON e.encomendaID = me.encomendaID
      LEFT JOIN SERVICOSDB.dbo.Medicamento m ON me.medicamentoID = m.medicamentoID
    `;
    const result = await pool.request().query(query);

    // Check if we have any results
    if (result.recordset.length === 0) {
      console.log('No encomendas found.');
      return;
    }

    // Group results by encomendaID (order) and include medication quantities
    const encomendas = {};
    result.recordset.forEach(row => {
      const orderID = row.encomendaID;
      if (!encomendas[orderID]) {
        encomendas[orderID] = {
          encomendaID: row.encomendaID,
          estadoID: row.estadoID,
          adminID: row.adminID,
          fornecedorID: row.fornecedorID,
          encomendaCompleta: row.encomendaCompleta,
          aprovadoPorAdministrador: row.aprovadoPorAdministrador,
          dataEncomenda: row.dataEncomenda,
          dataEntrega: row.dataEntrega,
          quantidadeEnviada: row.quantidadeEnviada,
          profissionalID: row.profissionalID,
          adminNome: row.adminNome,
          adminUltimoNome: row.adminUltimoNome,
          nomeFornecedor: row.nomeFornecedor,
          profissionalNome: row.profissionalNome,
          profissionalUltimoNome: row.profissionalUltimoNome,
          servicoNome: row.servicoNome,
          medicamentos: []
        };
      }

      // Add medication and quantity to the order
      if (row.medicamentoID) {
        encomendas[orderID].medicamentos.push({
          medicamentoID: row.medicamentoID,
          nomeMedicamento: row.nomeMedicamento,
          quantidade: row.medicamentoQuantidade
        });
      }
    });

    // Convert the encomendas object to an array
    const encomendasArray = Object.values(encomendas);

    // Send each encomenda to the backend one by one
    if (encomendasArray.length > 0) {
      for (const encomenda of encomendasArray) {
        try {
          const response = await axios.post('http://4.251.113.179:5000/receive-encomenda/', {
            encomenda
          });
          console.log(`Encomenda ${encomenda.encomendaID} sent successfully:`, response.data);
        } catch (error) {
          console.error(`Error sending encomenda ${encomenda.encomendaID}:`, error.message);
        }
      }
    } else {
      console.log('No encomendas to send.');
    }
  } catch (error) {
    console.error('Error executing minute task:', error.message);
  }
});

// Example route
app.get('/', (req, res) => {
  res.send('Express app with scheduled tasks');
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
