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

    // Query to fetch all orders (encomendas)
    const query = `
      SELECT e.encomendaID, e.estadoID, e.adminID, e.fornecedorID, e.encomendaCompleta,
             e.aprovadoPorAdministrador, e.dataEncomenda, e.dataEntrega, e.quantidadeEnviada,
             e.profissionalID, a.nomeProprio AS adminNome, a.ultimoNome AS adminUltimoNome,
             f.nomeFornecedor, p.nomeProprio AS profissionalNome, p.ultimoNome AS profissionalUltimoNome,
             sh.nomeServico AS servicoNome
      FROM SERVICOSDB.dbo.Encomenda e
      LEFT JOIN SERVICOSDB.dbo.Administrador a ON e.adminID = a.adminID
      LEFT JOIN SERVICOSDB.dbo.Fornecedor f ON e.fornecedorID = f.fornecedorID
      LEFT JOIN SERVICOSDB.dbo.Profissional_De_Saude p ON e.profissionalID = p.profissionalID
      LEFT JOIN SERVICOSDB.dbo.Servico_Hospitalar sh ON p.servicoID = sh.servicoID
    `;
    const result = await pool.request().query(query);
    const encomendas = result.recordset;

    console.log('Encomenda data:', encomendas);

    // Send each encomenda to the backend one by one
    if (encomendas.length > 0) {
      for (const encomenda of encomendas) {
        try {
          const response = await axios.post('http://4.251.113.179:3000/receive-encomenda', {
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
