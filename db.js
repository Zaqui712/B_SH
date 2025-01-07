const sql = require('mssql');
require('dotenv').config();

// Configure your Azure SQL Database connection
const poolPromise = new sql.ConnectionPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: process.env.DB_HOST,
    database: 'SERVICOSDB',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
})
    .connect()
    .then((pool) => {
        console.log('Connected to Azure SQL Database');
        return pool;
    })
    .catch((err) => {
        console.error('Database connection failed:', err);
        throw err;
    });


/**
 * Returns a connected pool instance.
 * @returns {Promise<sql.ConnectionPool>} The connected pool.
 */
const getPool = async () => {
    try {
        const pool = await poolPromise;
        if (!pool) throw new Error('Pool is undefined');
        console.log('Database pool acquired successfully');
        return pool;
    } catch (error) {
        console.error('Error acquiring database pool:', error);
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

        console.log("Executing Query:", query); // Log the query
        console.log("With Parameters:", params); // Log the parameters

        // Bind parameters to the request
        Object.keys(params).forEach((key) => {
            request.input(key, params[key]);
        });

        const result = await request.query(query);
        return result;
    } catch (error) {
        console.error('Error executing query:', error.message);
        throw new Error('Query execution failed');
    }
};

//Export the database helper functions
module.exports = { getPool, executeQuery };
