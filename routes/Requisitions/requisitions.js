const express = require('express');
const cors = require('cors'); // Import cors
const router = express.Router();
const { getPool } = require('../../db'); // Updated path
const jwt = require('jsonwebtoken');

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
  const { estadoID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega, medicamentos, servicoHospitalarRemetenteID } = req.body;

  console.log('Received request body:', req.body);

  // Extract the token from the Authorization header
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { userID, isAdmin } = decoded;

  if (!userID) {
    return res.status(400).json({ error: 'User ID not found in token' });
  }

  const profissionalID = !isAdmin ? userID : null; // Use userID as profissionalID if not admin
  const adminID = isAdmin ? userID : null; // Use userID as adminID if admin

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

    if (estadoCheckResult.recordset.length === 0 || estadoCheckResult.recordset[0].estadoCount === 0) {
      console.error(`estadoID ${estadoID} does not exist in Estado table`);
      return res.status(400).json({ error: `estadoID ${estadoID} does not exist in Estado table` });
    }

    // Start the transaction
    console.log('Starting transaction...');
    await transaction.begin();

    // Insert into Requisicao table including servicoHospitalarRemetenteID
    const requisicaoQuery = `
      INSERT INTO SERVICOSDB.dbo.Requisicao 
      (estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega, servicoHospitalarRemetenteID)
      OUTPUT INSERTED.requisicaoID
      VALUES (@estadoID, @profissionalID, @adminID, @aprovadoPorAdministrador, @requisicaoCompleta, @dataRequisicao, @dataEntrega, @servicoHospitalarRemetenteID)
    `;
    console.log('Executing requisicao insert query:', requisicaoQuery, { estadoID, profissionalID, adminID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega, servicoHospitalarRemetenteID });

    const requisicaoResult = await transaction.request()
      .input('estadoID', estadoID)
      .input('profissionalID', profissionalID)
      .input('adminID', adminID)
      .input('aprovadoPorAdministrador', aprovadoPorAdministrador || 0)
      .input('requisicaoCompleta', requisicaoCompleta || 0)
      .input('dataRequisicao', dataRequisicao)
      .input('dataEntrega', dataEntrega || null)
      .input('servicoHospitalarRemetenteID', servicoHospitalarRemetenteID || 0)  // Default to 0 if not provided
      .query(requisicaoQuery);

    console.log('Requisicao insert result:', requisicaoResult);

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
        let { medicamentoID, quantidade } = medicamento;

        // Ensure medicamentoID and quantidade are present and valid
        if (medicamentoID && quantidade) {
          // Check if medicamentoID is a number or a string (name)
          if (isNaN(medicamentoID)) {
            // If it's not a number, assume it's a name and look up the ID
            const medicamentoQuery = 'SELECT medicamentoID FROM SERVICOSDB.dbo.Medicamento WHERE nomeMedicamento = @nome';
            console.log('Executing medicamento name lookup query:', medicamentoQuery, { nome: medicamentoID });

            const medicamentoResult = await transaction.request()
              .input('nome', medicamentoID)
              .query(medicamentoQuery);

            if (medicamentoResult.recordset.length > 0) {
              medicamentoID = medicamentoResult.recordset[0].medicamentoID;
              console.log('Found medicamentoID for name:', medicamentoID);
            } else {
              console.error('Medicamento name not found:', medicamentoID);
              return res.status(400).json({ error: `Medicamento '${medicamentoID}' not found` });
            }
          }

          const medicamentoInsertQuery = `
            INSERT INTO SERVICOSDB.dbo.Medicamento_Requisicao (medicamentoID, requisicaoID, quantidade)
            VALUES (@medicamentoID, @requisicaoID, @quantidade)
          `;
          console.log('Executing medicamento insert query:', medicamentoInsertQuery, { medicamentoID, requisicaoID, quantidade });

          try {
            await transaction.request()
              .input('medicamentoID', medicamentoID)
              .input('requisicaoID', requisicaoID)
              .input('quantidade', quantidade)
              .query(medicamentoInsertQuery);

            console.log('Inserted medicamento:', { medicamentoID, quantidade });
          } catch (err) {
            console.error('Error inserting medicamento:', err.message);
            return res.status(500).json({ error: 'Error inserting medicamento' });
          }
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
    const pool = await getPool(); // Establish the database connection
    const query = `
      SELECT 
          R.requisicaoID,
          R.estadoID,
          R.profissionalID,
          R.adminID,
          R.aprovadoPorAdministrador,
          R.requisicaoCompleta,
          R.dataRequisicao,
          R.dataEntrega,
          P.nomeProprio AS nomeProfissional,
          P.ultimoNome AS ultimoNomeProfissional,
          P.contacto AS contactoProfissional,
          SH.servicoID,
          SH.nomeServico,
          SH.descServico,
          SH.localidadeServico,
          SH.servicoDisponivel24horas
      FROM 
          SERVICOSDB.dbo.Requisicao R
      JOIN 
          SERVICOSDB.dbo.Profissional_De_Saude P ON R.profissionalID = P.profissionalID
      JOIN 
          SERVICOSDB.dbo.Servico_Hospitalar SH ON P.servicoID = SH.servicoID
    `;

    const result = await pool.request().query(query); // Execute the SQL query
    res.status(200).json(result.recordset); // Send the query result as a JSON response
  } catch (error) {
    console.error('Error fetching requisitions:', error.message);
    res.status(500).json({ error: 'Error fetching requisitions' });
  }
});
//UPDATE
//APPROVE
router.post('/approve/:requisicaoID', async (req, res) => {
  const { requisicaoID } = req.params; // Extract requisicaoID from URL params
  const { aprovadoPorAdministrador } = req.body; // You can also send this value in the body

  console.log(`Approving request with requisicaoID: ${requisicaoID}`);

  // Extract the token from the Authorization header
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { userID, isAdmin } = decoded;

  if (!userID || !isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Only admin can approve' });
  }

  const pool = await getPool();
  
  try {
    // Start the transaction
    const transaction = pool.transaction();
    await transaction.begin();

    // Update the status of the requisicao to approved
    const approveQuery = `
      UPDATE SERVICOSDB.dbo.Requisicao 
      SET aprovadoPorAdministrador = @aprovadoPorAdministrador
      WHERE requisicaoID = @requisicaoID
    `;

    console.log('Executing approve query:', approveQuery, { requisicaoID, aprovadoPorAdministrador });

    const approveResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .input('aprovadoPorAdministrador', aprovadoPorAdministrador || 1) // 1 indicates approved
      .query(approveQuery);

    if (approveResult.rowsAffected === 0) {
      console.error(`No requisicao found with requisicaoID: ${requisicaoID}`);
      throw new Error('Requisicao not found or already approved');
    }

    // Commit the transaction
    console.log('Committing approval transaction...');
    await transaction.commit();

    // Respond with success
    console.log('Requisicao approved successfully:', { requisicaoID });
    res.status(200).json({ message: 'Requisicao approved successfully', requisicaoID });
  } catch (error) {
    // Rollback the transaction in case of error
    console.error('Rolling back transaction due to error...');
    await transaction.rollback();
    console.error('Error approving requisicao:', error.message);

    // Respond with error
    res.status(500).json({ error: 'Error approving requisicao', details: error.message });
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
