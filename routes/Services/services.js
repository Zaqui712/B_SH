const express = require('express');
const cors = require('cors');
const router = express.Router();
const { executeQuery } = require('../../db');
const jwt = require('jsonwebtoken'); // Importing the jwt package
const sql = require('mssql'); // Import mssql package



// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];  // Extract JWT token from Authorization header

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    let decoded;
	try {
		decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
		console.log('Decoded token:', decoded);  // Add this log
	} catch (err) {
		console.error('Error verifying token:', err);
		return res.status(401).json({ error: 'Unauthorized: Invalid token' });
	}
	console.log('Admin check result:', result.recordset);  // Add this log


    const { userID, isAdmin } = decoded;  // Get userID and isAdmin from decoded token

    // Check if the user has admin privileges
    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Only admin can access this resource' });
    }

    // Now we use the 'Administrador' table to check if the user is an admin
    try {
        const pool = await getPool();  // Get the connection pool
        const query = `
            SELECT a.adminID, c.utilizadorAdministrador 
            FROM dbo.Administrador a
            JOIN dbo.Credenciais c ON a.credenciaisID = c.credenciaisID
            WHERE a.adminID = @userID AND c.utilizadorAdministrador = 1`;

        const result = await pool.request().input('userID', sql.Int, userID).query(query);  // Use sql.Int for parameter type

        // If the user is not found or not an admin
        if (result.recordset.length === 0) {
            return res.status(403).json({ error: 'Forbidden: You are not authorized as an admin' });
        }

        // If everything is okay, proceed to the next middleware or route handler
        next();
    } catch (error) {
        console.error('Error fetching admin status:', error.message);
        
        // Additional handling for SQL errors or connection issues
        if (error.code === 'ESOCKET') {
            return res.status(500).json({ error: 'Database connection failed. Please try again later.' });
        }
        
        // General error
        return res.status(500).json({ error: 'Error fetching admin status', details: error.message });
    }
};


// CORS Configuration
const corsOptions = {
    origin: '*', // Replace with specific origin in production for security
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-user-role'],
};

router.use(cors(corsOptions));

// Helper to handle query execution
async function handleQueryExecution(query, params, res, successStatus = 200) {
    try {
        const results = await executeQuery(query, params);
        res.status(successStatus).json(results.recordset);
    } catch (error) {
        console.error('Database query error:', error.message);
        res.status(500).json({ error: error.message });
    }
}
//CREATE
// Admin-only: Create or Update stock
router.put('/add/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { medicamentoID, quantidadeDisponivel, quantidadeMinima } = req.body;

    try {
        const selectStockQuery = `
            SELECT medicamentoID FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
            WHERE servicoID = @id AND medicamentoID = @medicamentoID;
        `;
        const updateStockQuery = `
            UPDATE SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
            SET quantidadeDisponivel = @quantidadeDisponivel, quantidadeMinima = @quantidadeMinima
            WHERE servicoID = @id AND medicamentoID = @medicamentoID;
        `;
        const insertStockQuery = `
            INSERT INTO SERVICOSDB.dbo.Medicamento_Servico_Hospitalar
            (servicoID, medicamentoID, quantidadeDisponivel, quantidadeMinima)
            VALUES (@id, @medicamentoID, @quantidadeDisponivel, @quantidadeMinima);
        `;

        const stockCheck = await executeQuery(selectStockQuery, { id, medicamentoID });

        if (stockCheck.recordset.length > 0) {
            // Stock exists, update it
            await executeQuery(updateStockQuery, { id, medicamentoID, quantidadeDisponivel, quantidadeMinima });
            res.status(200).json({ message: 'Stock updated successfully.' });
        } else {
            // Stock does not exist, insert new record
            await executeQuery(insertStockQuery, { id, medicamentoID, quantidadeDisponivel, quantidadeMinima });
            res.status(201).json({ message: 'Stock added successfully.' });
        }
    } catch (error) {
        console.error('Error managing stock:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Admin-only: Create a new Servico_Hospitalar
router.post('/add', verifyAdmin, async (req, res) => {
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;

    const insertQuery = `
        INSERT INTO SERVICOSDB.dbo.Servico_Hospitalar
        (localidadeServico, nomeServico, descServico, servicoDisponivel24horas)
        VALUES (@localidadeServico, @nomeServico, @descServico, @servicoDisponivel24horas);
    `;
    
    const selectQuery = `
        SELECT TOP 1 servicoID, localidadeServico, nomeServico, descServico, servicoDisponivel24horas
        FROM SERVICOSDB.dbo.Servico_Hospitalar
        WHERE localidadeServico = @localidadeServico AND nomeServico = @nomeServico
        ORDER BY servicoID DESC;
    `;

    const values = { localidadeServico, nomeServico, descServico, servicoDisponivel24horas };

    try {
        // Execute the insert query
        await executeQuery(insertQuery, values);

        // Fetch the newly inserted record
        const result = await executeQuery(selectQuery, values);
        res.status(201).json(result.recordset[0]);
    } catch (error) {
        console.error('Error creating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});

//READ
// Fetch all services or search by criteria
router.get('/all', async (req, res) => {
    const { servicoID, localidadeServico } = req.query;
    let query = `
        SELECT servicoID, localidadeServico, nomeServico, descServico, servicoDisponivel24horas
        FROM SERVICOSDB.dbo.Servico_Hospitalar
        WHERE 1=1
    `;
    const params = {};

    if (servicoID) {
        query += ' AND servicoID = @servicoID';
        params.servicoID = servicoID;
    }

    if (localidadeServico) {
        query += ' AND localidadeServico LIKE @localidadeServico';
        params.localidadeServico = `%${localidadeServico}%`;
    }

    handleQueryExecution(query, params, res);
});

// Fetch specific service and its medication stock
router.get('/showstock/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const serviceQuery = `
            SELECT servicoID, nomeServico, descServico, localidadeServico, servicoDisponivel24horas
            FROM SERVICOSDB.dbo.Servico_Hospitalar
            WHERE servicoID = @id;
        `;

        const stockQuery = `
            SELECT ms.medicamentoID, m.nomeMedicamento, ms.quantidadeDisponivel, ms.quantidadeMinima
            FROM SERVICOSDB.dbo.Medicamento_Servico_Hospitalar ms
            JOIN SERVICOSDB.dbo.Medicamento m ON ms.medicamentoID = m.medicamentoID
            WHERE ms.servicoID = @id;
        `;

        const serviceResult = await executeQuery(serviceQuery, { id });
        if (serviceResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }

        const stockResult = await executeQuery(stockQuery, { id });
        res.status(200).json({ service: serviceResult.recordset[0], stock: stockResult.recordset });
    } catch (error) {
        console.error('Error fetching service and stock details:', error.message);
        res.status(500).json({ error: error.message });
    }
});

//UPDATE
// Admin-only: Edit an existing Servico_Hospitalar
router.put('/edit/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    const { localidadeServico, nomeServico, descServico, servicoDisponivel24horas } = req.body;

    const updateQuery = `
        UPDATE SERVICOSDB.dbo.Servico_Hospitalar
        SET localidadeServico = @localidadeServico,
            nomeServico = @nomeServico,
            descServico = @descServico,
            servicoDisponivel24horas = @servicoDisponivel24horas
        WHERE servicoID = @id;
    `;

    const values = { id, localidadeServico, nomeServico, descServico, servicoDisponivel24horas };

    try {
        const result = await executeQuery(updateQuery, values);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }

        res.status(200).json({ message: 'Servico_Hospitalar updated successfully.' });
    } catch (error) {
        console.error('Error updating Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});


//DELETE
// Admin-only: Delete a Servico_Hospitalar
router.delete('/delete/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;

    const deleteQuery = `
        DELETE FROM SERVICOSDB.dbo.Servico_Hospitalar
        WHERE servicoID = @id;
    `;

    try {
        const result = await executeQuery(deleteQuery, { id });

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Servico_Hospitalar not found' });
        }

        res.status(200).json({ message: 'Servico_Hospitalar deleted successfully.' });
    } catch (error) {
        console.error('Error deleting Servico_Hospitalar:', error.message);
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;

