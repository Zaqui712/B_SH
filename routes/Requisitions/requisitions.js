const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path

// Enable CORS for all origins
const corsOptions = {
  origin: '*', // Allow all origins (you can restrict this to specific domains in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  const { adminID } = req.body;
  try {
    const pool = await getPool();
    const query = 'SELECT utilizadorAdministrador FROM SERVICOSDB.dbo.Credenciais WHERE credenciaisID = @adminID';
    const result = await pool.request().input('adminID', adminID).query(query);

    if (result.recordset.length > 0 && result.recordset[0].utilizadorAdministrador) {
      next();
    } else {
      res.status(403).send('Access denied. Only administrators can approve requests.');
    }
  } catch (error) {
    console.error('Error verifying admin:', error.message);
    res.status(400).send(error.message);
  }
};

router.post('/create', async (req, res) => {
  const { estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega, medicamentos } = req.body;

  console.log('Received request body:', req.body);

  const pool = await getPool();
  const transaction = pool.transaction();

  try {
    // Check if estadoID exists in Estado table
    const estadoCheckQuery = 'SELECT COUNT(*) AS estadoCount FROM SERVICOSDB.dbo.Estado WHERE estadoID = @estadoID';
    console.log('Executing estado check query:', estadoCheckQuery, { estadoID });
    const estadoCheckResult = await pool.request()
      .input('estadoID', estadoID)
      .query(estadoCheckQuery);

    console.log('Estado check result:', estadoCheckResult);

    // Ensure the query returns a result before checking
    if (estadoCheckResult.recordset.length === 0 || estadoCheckResult.recordset[0].estadoCount === 0) {
      console.error(`estadoID ${estadoID} does not exist in Estado table`);
      return res.status(400).json({ error: `estadoID ${estadoID} does not exist in Estado table` });
    }

    // Start the transaction
    console.log('Starting transaction...');
    await transaction.begin();

    // Insert into Requisicao table
    const requisicaoQuery = `
      INSERT INTO SERVICOSDB.dbo.Requisicao 
      (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega)
      OUTPUT INSERTED.requisicaoID
      VALUES (@estadoID, @profissionalID, @adminID, @aprovadoPorAdministrador, @requisicaoCompleta, @dataRequisicao, @dataEntrega)
    `;
    console.log('Executing requisicao insert query:', requisicaoQuery, { estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega });

    const requisicaoResult = await transaction.request()
      .input('estadoID', estadoID)
      .input('profissionalID', profissionalID)
      .input('adminID', adminID)
      .input('aprovadoPorAdministrador', aprovadoPorAdministrador || 0)
      .input('requisicaoCompleta', requisicaoCompleta || 0)
      .input('dataRequisicao', dataRequisicao)
      .input('dataEntrega', dataEntrega || null)
      .query(requisicaoQuery);

    console.log('Requisicao insert result:', requisicaoResult);

    // Ensure requisicaoID is returned correctly
    if (!requisicaoResult.recordset || requisicaoResult.recordset.length === 0) {
      console.error('Requisicao insert failed, no ID returned.');
      throw new Error('Failed to create requisicao.');
    }

    const requisicaoID = requisicaoResult.recordset[0].requisicaoID;
    console.log('Created requisicaoID:', requisicaoID);

    // Ensure 'medicamentos' is defined and an array, and check if it has at least one element
    if (Array.isArray(medicamentos) && medicamentos.length > 0) {
      console.log('Processing medicamentos:', medicamentos);
      for (const medicamento of medicamentos) {
        const { medicamentoID, quantidade } = medicamento;

        // Ensure medicamentoID and quantidade are present and valid
        if (medicamentoID && quantidade) {
          const medicamentoQuery = `
            INSERT INTO SERVICOSDB.dbo.Medicamento_Requisicao (medicamentoID, requisicaoID, quantidade)
            VALUES (@medicamentoID, @requisicaoID, @quantidade)
          `;
          console.log('Executing medicamento insert query:', medicamentoQuery, { medicamentoID, requisicaoID, quantidade });

          await transaction.request()
            .input('medicamentoID', medicamentoID)
            .input('requisicaoID', requisicaoID)
            .input('quantidade', quantidade)
            .query(medicamentoQuery);

          console.log('Inserted medicamento:', { medicamentoID, quantidade });
        } else {
          console.error('Invalid medicamento data:', medicamento);
        }
      }
    } else {
      console.warn('Medicamentos array is empty or not defined');
    }

    // Commit the transaction
    console.log('Committing transaction...');
    await transaction.commit();

    // Respond with success
    console.log('Request created successfully:', { requisicaoID });
    res.status(201).json({ message: 'Request created successfully', requisicaoID });
  } catch (error) {
    // Rollback the transaction in case of error
    console.error('Rolling back transaction due to error...');
    await transaction.rollback();
    console.error('Error creating request:', error.message);

    // Respond with error
    res.status(500).json({ error: 'Error creating request', details: error.message });
  }
});

// READ
// Fetch all requests with medication details
router.get('/all', async (req, res) => {
  try {
    const pool = await getPool(); // Establish a connection to the SQL Server
    const query = `
      SELECT req.*, 
             mr.medicamentoID, 
             mr.quantidade, 
             med.nomeMedicamento
      FROM SERVICOSDB.dbo.Requisicao req
      LEFT JOIN SERVICOSDB.dbo.Medicamento_Requisicao mr ON req.requisicaoID = mr.requisicaoID
      LEFT JOIN SERVICOSDB.dbo.Medicamento med ON mr.medicamentoID = med.medicamentoID
    `;
    const result = await pool.request().query(query); // Execute the SQL query
    res.status(200).json(result.recordset); // Send the fetched data as JSON
  } catch (error) {
    console.error('Error listing requests:', error.message); // Log any errors
    res.status(500).json({ error: 'Error listing requests' }); // Send a 500 status with an error message
  }
});


// Fetch pending approval requests with medication details
router.get('/pending-approval', async (req, res) => {
  try {
    const pool = await getPool();
    const query = `
      SELECT req.*, 
             pro.nomeProprio, 
             pro.ultimoNome, 
             mr.medicamentoID, 
             mr.quantidade, 
             med.nomeMedicamento
      FROM SERVICOSDB.dbo.Requisicao req
      JOIN SERVICOSDB.dbo.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
      LEFT JOIN SERVICOSDB.dbo.Medicamento_Requisicao mr ON req.requisicaoID = mr.requisicaoID
      LEFT JOIN SERVICOSDB.dbo.Medicamento med ON mr.medicamentoID = med.medicamentoID
      WHERE req.aprovadoPorAdministrador = 0
    `;
    const result = await pool.request().query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching pending requests:', error.message);
    res.status(500).json({ error: 'Error fetching pending requests' });
  }
});

// Fetch requests by health unit with medication details
router.get('/list/:servicoID', async (req, res) => {
  const { servicoID } = req.params;
  try {
    const pool = await getPool();
    const query = `
      SELECT req.*, 
             pro.nomeProprio, 
             pro.ultimoNome, 
             mr.medicamentoID, 
             mr.quantidade, 
             med.nomeMedicamento
      FROM SERVICOSDB.dbo.Requisicao req
      JOIN SERVICOSDB.dbo.Profissional_De_Saude pro ON req.profissionalID = pro.profissionalID
      LEFT JOIN SERVICOSDB.dbo.Medicamento_Requisicao mr ON req.requisicaoID = mr.requisicaoID
      LEFT JOIN SERVICOSDB.dbo.Medicamento med ON mr.medicamentoID = med.medicamentoID
      WHERE pro.servicoID = @servicoID
    `;
    const result = await pool.request().input('servicoID', servicoID).query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching requests for health unit:', error.message);
    res.status(500).json({ error: 'Error fetching requests for health unit' });
  }
});

// DELETE
router.delete('/:requestID', async (req, res) => {
  const { requestID } = req.params;

  try {
    const pool = await getPool();

    // Delete associated records in Medicamento_Requisicao
    const deleteMedicamentoQuery = `
      DELETE FROM SERVICOSDB.dbo.Medicamento_Requisicao
      WHERE requisicaoID = @requestID
    `;
    await pool.request().input('requestID', requestID).query(deleteMedicamentoQuery);

    // Delete the requisition without OUTPUT clause temporarily
    const deleteRequestQuery = `
      DELETE FROM SERVICOSDB.dbo.Requisicao
      WHERE requisicaoID = @requestID
    `;
    const result = await pool.request().input('requestID', requestID).query(deleteRequestQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    res.status(200).json({ message: 'Request deleted successfully.' });
  } catch (error) {
    console.error('Error deleting request:', error.message);
    res.status(500).json({ error: 'Error deleting request' });
  }
});



module.exports = router;
