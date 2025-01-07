const sql = require('mssql');
require('dotenv').config();

// Define your Azure SQL Database connection configuration
const poolPromise = new sql.ConnectionPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST, // Usually in format: 'servername.database.windows.net'
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Needed for Azure SQL
        trustServerCertificate: true // Disable SSL verification (optional, but useful for testing)
    }
}).connect();

const getPool = async () => {
    try {
        const pool = await poolPromise;
        return pool;
    } catch (error) {
        console.error('Error connecting to database: ', error);
        throw new Error('Database connection failed');
    }
};

module.exports = { getPool };
