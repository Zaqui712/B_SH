const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const sql = require('mssql'); // Assuming you're using SQL Server
const { getPool } = require('../../db'); // Assuming you are using this to interact with the database

const router = express.Router();

// Example of a task that runs every minute
cron.schedule('* * * * *', async () => {
  try {
    console.log('Running task every minute');
    const pool = await getPool();

    // Query to fetch all orders (encomendas) along with associated medications
    const query = 
      `SELECT e.encomendaID, e.estadoID, e.adminID, e.fornecedorID, e.encomendaCompleta,
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
       LEFT JOIN SERVICOSDB.dbo.Medicamento m ON me.medicamentoID = m.medicamentoID`;
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

    // Log the values of aprovadoPorAdministrador for each encomenda
    encomendasArray.forEach(encomenda => {
      console.log(`Encomenda ID: ${encomenda.encomendaID}, AprovadoPorAdministrador: ${encomenda.aprovadoPorAdministrador}`);
    });

    // Filter encomendas to only include those that are approved by admin
    const approvedEncomendas = encomendasArray.filter(encomenda => encomenda.aprovadoPorAdministrador === true);

    // Log the number of approved encomendas
    console.log(`Number of approved encomendas: ${approvedEncomendas.length}`);

    // Variable to count the number of successful sends
    let sentCount = 0;

    // Send each approved encomenda to the backend one by one using Promise.all
    if (approvedEncomendas.length > 0) {
      const sendPromises = approvedEncomendas.map(async (encomenda) => {
		  try {
			console.log(`Sending encomenda ID: ${encomenda.encomendaID}`);

			// Create the request body
			const requestBody = {
			  encomendaID: encomenda.encomendaID,
			  estadoID: encomenda.estadoID,
			  fornecedorID: encomenda.fornecedorID,
			  quantidadeEnviada: encomenda.quantidadeEnviada,
			  nomeFornecedor: encomenda.nomeFornecedor, // Add fornecedor name
			  profissionalNome: encomenda.profissionalNome, // Add profissional name
			  medicamentos: encomenda.medicamentos.map(med => ({
				medicamentoID: med.medicamentoID,
				nomeMedicamento: med.nomeMedicamento, // Add medicamento name
				quantidade: med.quantidade
			  }))
			};

			// Log the request body to see if it contains data in the correct format
			console.log('Request Body:', JSON.stringify(requestBody, null, 2));

			const response = await axios.post('http://4.251.113.179:5000/receive-encomenda/', requestBody, {
			  headers: {
				'Content-Type': 'application/json'
			  }
			});

			console.log(`Encomenda ${encomenda.encomendaID} sent successfully:`, response.status, response.data);
			sentCount++;
		  } catch (error) {
			// Log detailed error information
			if (error.response) {
			  console.error(`Error sending encomenda ${encomenda.encomendaID}:`, error.response.status, error.response.data);
			} else {
			  console.error(`Error sending encomenda ${encomenda.encomendaID}:`, error.message);
			}
		  }
		});

      // Wait for all promises to resolve
      await Promise.all(sendPromises);
    } else {
      console.log('No approved encomendas to send.');
    }

    // Log how many encomendas were sent successfully
    console.log(`Total encomendas sent: ${sentCount}`);
  } catch (error) {
    console.error('Error executing minute task:', error.message);
  }
});

// Example route
router.get('/', (req, res) => {
  res.send('Express router with scheduled tasks');
});

// Export the router
module.exports = router;
