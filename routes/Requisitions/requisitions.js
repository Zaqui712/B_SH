const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getPool } = require('../../db');
const jwt = require('jsonwebtoken');

// Enable CORS for all origins
const corsOptions = {
  origin: '*', // Allow all origins (adjust for production)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS middleware globally
router.use(cors(corsOptions));

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];  // Extract JWT token from Authorization header

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');  // Verify token using the secret
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { userID, isAdmin } = decoded;  // Get userID and isAdmin from decoded token

  // Check if the user has admin privileges
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Only admin can access this resource' });
  }

  // Optionally, you can check if the userID exists in the Users table, though it's usually redundant with JWT verification
  try {
    const pool = await getPool();
    const query = `
      SELECT * FROM dbo.Users  -- Ensure this matches the actual table name and schema
      WHERE userID = @userID AND role = 'admin'`;  // Query to check if the user is an admin

    const result = await pool.request().input('userID', userID).query(query);

    // If the user is not found or not an admin
    if (result.recordset.length === 0) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized as an admin' });
    }

    // If everything is okay, proceed to the next middleware or route handler
    next();
  } catch (error) {
    if (error.code === 'ESOCKET') {
      // Database connection error
      return res.status(500).json({ error: 'Database connection failed. Please try again later.' });
    } else {
      // General error
      console.error('Database query error:', error.message);
      return res.status(500).json({ error: 'Error fetching admin status', details: error.message });
    }
  }
};




router.post('/create', async (req, res) => {
  const { estadoID, aprovadoPorAdministrador, requisicaoCompleta, dataRequisicao, dataEntrega, medicamentos, servicoHospitalarRemetenteID } = req.body;
  console.log('Received request body:', req.body);

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

  const profissionalID = !isAdmin ? userID : null;
  const adminID = isAdmin ? userID : null;

  const pool = await getPool();
  const transaction = pool.transaction();

  try {
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

    await transaction.begin();

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
      .input('servicoHospitalarRemetenteID', servicoHospitalarRemetenteID || 0)
      .query(requisicaoQuery);

    console.log('Requisicao insert result:', requisicaoResult);

    if (!requisicaoResult.recordset || requisicaoResult.recordset.length === 0) {
      console.error('Requisicao insert failed, no ID returned.');
      throw new Error('Failed to create requisicao.');
    }

    const requisicaoID = requisicaoResult.recordset[0].requisicaoID;
    console.log('Created requisicaoID:', requisicaoID);

    if (Array.isArray(medicamentos) && medicamentos.length > 0) {
      console.log('Processing medicamentos:', medicamentos);
      for (const medicamento of medicamentos) {
        let { medicamentoID, quantidade } = medicamento;

        if (medicamentoID && quantidade) {
          if (isNaN(medicamentoID)) {
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

    await transaction.commit();
    console.log('Request created successfully:', { requisicaoID });
    res.status(201).json({ message: 'Request created successfully', requisicaoID });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating request:', error.message);
    res.status(500).json({ error: 'Error creating request', details: error.message });
  }
});

// Read all requisitions
router.get('/all', async (req, res) => {
  try {
    const pool = await getPool();
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
          SH.servicoDisponivel24horas,
          SRH.nomeServico AS nomeServicoHospitalarRemetente
      FROM 
          SERVICOSDB.dbo.Requisicao R
      JOIN 
          SERVICOSDB.dbo.Profissional_De_Saude P ON R.profissionalID = P.profissionalID
      JOIN 
          SERVICOSDB.dbo.Servico_Hospitalar SH ON P.servicoID = SH.servicoID
      LEFT JOIN 
          SERVICOSDB.dbo.Servico_Hospitalar SRH ON R.servicoHospitalarRemetenteID = SRH.servicoID
    `;
    const result = await pool.request().query(query);
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching requisitions:', error.message);
    res.status(500).json({ error: 'Error fetching requisitions' });
  }
});

// Approve request
router.put('/approve/:requisicaoID', verifyAdmin, async (req, res) => {
  let { requisicaoID } = req.params;
  requisicaoID = parseInt(requisicaoID, 10);
  if (isNaN(requisicaoID)) {
    return res.status(400).json({ error: 'Invalid requisicaoID. It must be an integer.' });
  }

  // Now the verifyAdmin middleware has already verified that the user is an admin
  const token = req.headers.authorization?.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  const { userID } = decoded;  // Use userID from decoded token for DB operations

  const pool = await getPool();
  let transaction;

  try {
    transaction = pool.transaction();
    await transaction.begin();

    const validateQuery = `
      SELECT COUNT(*) AS requisicaoExists 
      FROM SERVICOSDB.dbo.Requisicao 
      WHERE requisicaoID = @requisicaoID AND aprovadoPorAdministrador = 0`;
    const validateResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .query(validateQuery);

    if (validateResult.recordset[0].requisicaoExists === 0) {
      console.error(`Requisicao not found or already approved with requisicaoID: ${requisicaoID}`);
      throw new Error('Requisicao not found or already approved');
    }

    const aprovadoPorAdministrador = 1;

    const approveQuery = `
      UPDATE SERVICOSDB.dbo.Requisicao 
      SET aprovadoPorAdministrador = @aprovadoPorAdministrador, adminID = @adminID 
      WHERE requisicaoID = @requisicaoID`;

    const approveResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .input('aprovadoPorAdministrador', aprovadoPorAdministrador)
      .input('adminID', userID)  // Use userID from decoded token
      .query(approveQuery);

    if (approveResult.rowsAffected === 0) {
      console.error(`No requisicao found with requisicaoID: ${requisicaoID}`);
      throw new Error('Requisicao not found or already approved');
    }

    const updateEstadoQuery = `
      UPDATE SERVICOSDB.dbo.Requisicao 
      SET estadoID = 3 
      WHERE requisicaoID = @requisicaoID`;

    await transaction.request()
      .input('requisicaoID', requisicaoID)
      .query(updateEstadoQuery);

    await transaction.commit();
    console.log(`Requisicao ${requisicaoID} approved successfully.`);
    res.status(200).json({ message: `Requisicao ${requisicaoID} approved successfully.` });

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error approving requisicao:', error.message);
    res.status(500).json({ error: 'Error approving requisicao', details: error.message });
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
          SH.servicoDisponivel24horas,
          SRH.nomeServico AS nomeServicoHospitalarRemetente
      FROM 
          SERVICOSDB.dbo.Requisicao R
      JOIN 
          SERVICOSDB.dbo.Profissional_De_Saude P ON R.profissionalID = P.profissionalID
      JOIN 
          SERVICOSDB.dbo.Servico_Hospitalar SH ON P.servicoID = SH.servicoID
      LEFT JOIN 
          SERVICOSDB.dbo.Servico_Hospitalar SRH ON R.servicoHospitalarRemetenteID = SRH.servicoID
    `;

    const result = await pool.request().query(query); // Execute the SQL query
    res.status(200).json(result.recordset); // Send the query result as a JSON response
  } catch (error) {
    console.error('Error fetching requisitions:', error.message);
    res.status(500).json({ error: 'Error fetching requisitions' });
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

// UPDATE
// APPROVE
router.put('/approve/:requisicaoID', verifyAdmin, async (req, res) => {
  let { requisicaoID } = req.params;

  // Ensure requisicaoID is an integer
  requisicaoID = parseInt(requisicaoID, 10);
  if (isNaN(requisicaoID)) {
    return res.status(400).json({ error: 'Invalid requisicaoID. It must be an integer.' });
  }

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
  let transaction;

  try {
    // Start the transaction
    transaction = pool.transaction();
    await transaction.begin();

    // Validate requisicaoID exists and is pending approval
    const validateQuery = 
      `SELECT COUNT(*) AS requisicaoExists 
       FROM SERVICOSDB.dbo.Requisicao
       WHERE requisicaoID = @requisicaoID AND aprovadoPorAdministrador = 0`;
    const validateResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .query(validateQuery);

    if (validateResult.recordset[0].requisicaoExists === 0) {
      console.error(`Requisicao not found or already approved with requisicaoID: ${requisicaoID}`);
      throw new Error('Requisicao not found or already approved');
    }

    // Set the approval status to 1 (approved)
    const aprovadoPorAdministrador = 1;

    // Execute the approval update and set adminID to the user approving the request
    const approveQuery = 
      `UPDATE SERVICOSDB.dbo.Requisicao
       SET aprovadoPorAdministrador = @aprovadoPorAdministrador, adminID = @adminID
       WHERE requisicaoID = @requisicaoID`;
    console.log('Executing approval query:', approveQuery, { requisicaoID, aprovadoPorAdministrador });

    const approveResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .input('aprovadoPorAdministrador', aprovadoPorAdministrador)
      .input('adminID', userID) // Set the adminID to the one approving the order
      .query(approveQuery);

    if (approveResult.rowsAffected === 0) {
      console.error(`No requisicao found with requisicaoID: ${requisicaoID}`);
      throw new Error('Requisicao not found or already approved');
    }

    // Update estadoID to 3 after approval (assuming 3 is for approved state)
    const updateEstadoQuery = 
      `UPDATE SERVICOSDB.dbo.Requisicao
       SET estadoID = 3
       WHERE requisicaoID = @requisicaoID`;
    console.log('Executing update estadoID query:', updateEstadoQuery, { requisicaoID });

    const updateEstadoResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .query(updateEstadoQuery);

    if (updateEstadoResult.rowsAffected === 0) {
      console.error(`Failed to update estadoID for requisicaoID: ${requisicaoID}`);
      throw new Error('Failed to update estadoID');
    }

    // Commit the transaction
    await transaction.commit();

    // Respond with success
    console.log('Requisicao approved and estadoID updated to 3 successfully:', { requisicaoID });
    res.status(200).json({ message: 'Requisicao approved and estadoID updated to 3 successfully', requisicaoID });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback(); // Ensure rollback occurs even in error case
        console.log('Transaction rolled back');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError.message);
      }
    }
    console.error('Error approving requisicao:', error.message);
    res.status(500).json({ error: 'Error approving requisicao', details: error.message });
  }
});


// CANCEL
// CANCEL
router.put('/cancel/:requisicaoID', verifyAdmin, async (req, res) => {
  let { requisicaoID } = req.params;

  requisicaoID = parseInt(requisicaoID, 10); // Ensure requisicaoID is an integer
  if (isNaN(requisicaoID)) {
    return res.status(400).json({ error: 'Invalid requisicaoID. It must be an integer.' });
  }

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
    return res.status(403).json({ error: 'Forbidden: Only admin can cancel' });
  }

  const pool = await getPool();
  let transaction;

  try {
    // Start the transaction
    transaction = pool.transaction();
    await transaction.begin();

    // Validate requisicaoID exists
    const validateQuery = 
      `SELECT COUNT(*) AS requisicaoExists
       FROM SERVICOSDB.dbo.Requisicao
       WHERE requisicaoID = @requisicaoID`;
    const validateResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .query(validateQuery);

    if (validateResult.recordset[0].requisicaoExists === 0) {
      console.error(`Requisicao not found with requisicaoID: ${requisicaoID}`);
      throw new Error('Requisicao not found');
    }

    // Execute the cancellation update and set adminID to the user canceling the request
    const cancelQuery = 
      `UPDATE SERVICOSDB.dbo.Requisicao
       SET estadoID = 2, adminID = @adminID -- Assuming 2 is canceled state
       WHERE requisicaoID = @requisicaoID`;
    console.log('Executing cancel query:', cancelQuery, { requisicaoID });

    const cancelResult = await transaction.request()
      .input('requisicaoID', requisicaoID)
      .input('adminID', userID) // Set the adminID to the one canceling the order
      .query(cancelQuery);

    if (cancelResult.rowsAffected === 0) {
      console.error(`No requisicao found with requisicaoID: ${requisicaoID}`);
      throw new Error('Requisicao not found or already canceled');
    }

    // Commit the transaction
    await transaction.commit();

    // Respond with success
    console.log('Requisicao canceled successfully:', { requisicaoID });
    res.status(200).json({ message: 'Requisicao canceled successfully', requisicaoID });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback(); // Ensure rollback occurs even in error case
        console.log('Transaction rolled back');
      } catch (rollbackError) {
        console.error('Error rolling back transaction:', rollbackError.message);
      }
    }
    console.error('Error canceling requisicao:', error.message);
    res.status(500).json({ error: 'Error canceling requisicao', details: error.message });
  }
});


// DELETE
router.delete('/delete/:requestID', async (req, res) => {
  const { requestID } = req.params;

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

  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Only administrators can delete requests' });
  }

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
