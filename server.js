const express = require('express');
const app = express();
const { getPool } = require('./db');

const requisicoesRoutes = require('./routes/Requisicoes/requisicao');
const encomendasRoutes = require('./routes/Encomendas/encomendas');
const gerarEncomendasRoutes = require('./routes/Encomendas/gerarEncomendas');
const aprovacoesRoutes = require('./routes/Aprovacoes/aprovacoes');
const balancearStockRoutes = require('./routes/BalancearStock/balancearStock');
const checkDatabaseRoutes = require('./routes/CheckDatabase/checkDatabase');

const alertsRoutes = require('./routes/CheckDatabase/alerts'); // Updated variable name

const authRoutes = require('./routes/Auth/auth');
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Include the routes
app.use('/api/requisicoes', requisicoesRoutes);
app.use('/api/encomendas', encomendasRoutes);
app.use('/api/gerarEncomendas', gerarEncomendasRoutes);
app.use('/api/aprovacoes', aprovacoesRoutes);
app.use('/api/balancearStock', balancearStockRoutes);
app.use('/api/checkDatabase', checkDatabaseRoutes);
app.use('/api/alerts', alertsRoutes); // Updated variable name
app.use('/api/auth', authRoutes);
