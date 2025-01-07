const sql = require('mssql');
require('dotenv').config();

// Configure your Azure SQL Database connection
const poolPromise = new sql.ConnectionPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST, // Format: 'servername.database.windows.net'
    database: 'SERVICOSDB', // Explicitly set the database name to SERVICOSDB
    options: {
        encrypt: true, // Required for Azure SQL
        trustServerCertificate: true // Disable SSL verification (optional, for testing)
    }
}).connect(); // Creates and connects the pool

/**
 * Returns a connected pool instance.
 * @returns {Promise<sql.ConnectionPool>} The connected pool.
 */
const getPool = async () => {
    try {
        const pool = await poolPromise;
        return pool;
    } catch (error) {
        console.error('Error connecting to database:', error);
        throw new Error('Database connection failed');
    }
};

/**
 * Executes a parameterized query on the database.
 * @param {string} query - SQL query to execute.
 * @param {Object} params - Object of query parameters.
 * @returns {Promise<sql.IResult<any>>} Query result.
 */
const executeQuery = async (query, params = {}) => {
    try {
        const pool = await getPool();
        const request = pool.request();

        // Bind parameters to the request
        Object.keys(params).forEach((key) => {
            request.input(key, params[key]);
        });

        const result = await request.query(query);
        return result;
    } catch (error) {
        console.error('Error executing query:', error);
        throw new Error('Query execution failed');
    }
};

// Export the database helper functions
module.exports = { getPool, executeQuery };
