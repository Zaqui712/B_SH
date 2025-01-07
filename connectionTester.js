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

// Test the connection
const testConnection = async () => {
    try {
        // Connect to the database
        await sql.connect(config);
        console.log('Connected to the Azure SQL Database successfully!');
        
        // Optionally, you can run a simple query to verify
        const result = await sql.query('SELECT 1 AS test');
        console.log('Test query result:', result.recordset);
        
        // Close the connection
        await sql.close();
    } catch (err) {
        console.error('Failed to connect to the database:', err);
    }
};

testConnection();
