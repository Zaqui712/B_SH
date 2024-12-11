const express = require('express');
const app = express();
const { getPool } = require('./db');
const requisicoesRoutes = require('./routes/requisicoes/requisicao');
const encomendasRoutes = require('./routes/encomendas/encomendas');
const gerarEncomendasRoutes = require('./routes/encomendas/gerarEncomendas');
const aprovacoesRoutes = require('./routes/aprovacoes/aprovacoes');
const balancearStockRoutes = require('./routes/balancearStock/balancearStock');
const checkDatabaseRoutes = require('./routes/checkDatabase/checkDatabase');
const authRoutes = require('./routes/auth/auth');
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
app.use('/api/auth', authRoutes);
