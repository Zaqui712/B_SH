const sql = require('mssql');
require('dotenv').config();

// Define the configuration for connecting to the database
const config = {
    user: process.env.DB_USER,  // Set your username
    password: process.env.DB_PASS,  // Set your password
    server: process.env.DB_HOST,  // Server address (e.g., <your-server>.database.windows.net)
    database: 'SERVICOSDB',  // Explicitly set the database name to SERVICOSDB
    options: {
        encrypt: true,  // Required for Azure SQL Database
        trustServerCertificate: true  // Disable SSL certificate validation (useful for testing)
    }
};

// Test the connection and perform SELECT queries
const testConnection = async () => {
    try {
        // Connect to the database
        await sql.connect(config);
        console.log('Connected to the Azure SQL Database successfully!');
        
        // Perform SELECT queries on the same tables as services.js
        const selectServicesQuery = `
            SELECT sh.servicoID, sh.localidadeServico, sh.nomeServico, sh.descServico, sh.servicoDisponivel24horas
            FROM Servico_Hospitalar sh
        `;
        const servicesResult = await sql.query(selectServicesQuery);
        console.log('Services query result:', servicesResult.recordset);

        // Close the connection
        await sql.close();
    } catch (err) {
        console.error('Failed to connect to the database or execute query:', err);
    }
};

testConnection();
