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

const executeQuery = async (query, params = []) => {
    try {
        const pool = await getPool();
        const request = pool.request();
        
        // Bind parameters if provided
        params.forEach((param, index) => {
            request.input(`param${index + 1}`, param);
        });

        const result = await request.query(query);
        return result;
    } catch (error) {
        console.error('Error executing query: ', error);
        throw new Error('Query execution failed');
    }
};

module.exports = { getPool, executeQuery };
