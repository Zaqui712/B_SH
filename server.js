const express = require('express');
const app = express();
const { getPool } = require('./db');

const requisitionsRoutes = require('./routes/Requisitions/requisitions');
const ordersRoutes = require('./routes/Orders/orders');
const automaticOrdersRoutes = require('./routes/Orders/automaticOrders');
const approvalRoutes = require('./routes/Approvals/approvals');
const stockBalancerRoutes = require('./routes/StockManagement/stockBalancer');
const checkDatabaseRoutes = require('./routes/CheckDatabase/checkDatabase');
const alertsRoutes = require('./routes/CheckDatabase/alerts');

const servicesRoutes = require('./routes/Services/services'); 
const authRoutes = require('./routes/LoginAuthentication/authentication');
const notificationsRoutes = require('./routes/Notifications/notifications');
const productsRoutes = require('./routes/Products/products');
const stockRoutes = require('./routes/StockManagement/stock');
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Include the routes
app.use('/api/requisicoes', requisitionsRoutes);
app.use('/api/encomendas', ordersRoutes);
app.use('/api/gerarEncomendas', automaticOrdersRoutes);
app.use('/api/aprovacoes', approvalRoutes);
app.use('/api/balancearStock', stockBalancerRoutes);
app.use('/api/checkDatabase', checkDatabaseRoutes);
app.use('/api/alerts', alertsRoutes); 
app.use('/api/services', servicesRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);
