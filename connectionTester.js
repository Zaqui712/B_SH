const sql = require('mssql');
require('dotenv').config();

// Define the configuration for connecting to the database
const config = {
    user: process.env.DB_USER,  // Set your username
    password: process.env.DB_PASS,  // Set your password
    server: process.env.DB_HOST,  // Server address (e.g., <your-server>.database.windows.net)
    database: process.env.DB_NAME,  // Database name
    options: {
        encrypt: true,  // Required for Azure SQL Database
        trustServerCertificate: true  // Disable SSL certificate validation (useful for testing)
    }
};

// Test the connection and list all tables in the SERVICOSDB schema
const testConnection = async () => {
    try {
        // Connect to the database
        await sql.connect(config);
        console.log('Connected to the Azure SQL Database successfully!');
        
        // List all tables in the SERVICOSDB schema
        const listTablesQuery = `
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = 'SERVICOSDB'
        `;
        const tablesResult = await sql.query(listTablesQuery);
        console.log('Tables in SERVICOSDB schema:', tablesResult.recordset);

        // Close the connection
        await sql.close();
    } catch (err) {
        console.error('Failed to connect to the database or execute query:', err);
    }
};

testConnection();
