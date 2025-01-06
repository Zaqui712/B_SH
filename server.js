const express = require('express');
const app = express();
const { getPool } = require('./db');

const requisitionsRoutes = require('./routes/Requisitions/requisitions');
const automaticRequisitionsRoutes = require('./routes/Requisitions/automaticRequisitions');
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

// Middleware
app.use(express.json());

// Include the routes with corrected paths
app.use('/api/requests', requisitionsRoutes);
app.use('/api/automatic-requests', automaticRequisitionsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/automatic-orders', automaticOrdersRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/stock-balancer', stockBalancerRoutes);
app.use('/api/check-database', checkDatabaseRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
