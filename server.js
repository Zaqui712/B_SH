const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const { getPool } = require('./db'); // Assuming you are using this to interact with the database

// Initialize the Express app
const app = express();

// Middleware
app.use(express.json());
/*
// Supplier routes
const supplierRoutes = require('./routes/Supplier/supplier');
console.log(supplierRoutes);  // Make sure it's a valid router
console.log(typeof supplierRoutes);  // It should log 'object'
console.log(supplierRoutes instanceof express.Router);  // This should be true if it's a Router
*/
// Requisitions
const requisitionsRoutes = require('./routes/Requisitions/requisitions');
const automaticRequisitionsRoutes = require('./routes/Requisitions/automaticRequisitions');
const requisitionsLogicRoutes = require('./routes/Requisitions/requisitionsLogic');

app.use('/api/requests', requisitionsRoutes);
app.use('/api/automatic-requests', automaticRequisitionsRoutes);
app.use('/api/requests', requisitionsLogicRoutes);

// Orders
const ordersRoutes = require('./routes/Orders/orders');
const automaticOrdersRoutes = require('./routes/Orders/automaticOrders');
app.use('/api/orders', ordersRoutes);
app.use('/api/automatic-orders', automaticOrdersRoutes);

// Stock Management
const stockRoutes = require('./routes/StockManagement/stock');
const stockBalancerRoutes = require('./routes/StockManagement/stockBalancer');
app.use('/api/stock', stockRoutes);
app.use('/api/stock-balancer', stockBalancerRoutes);

// Services
const servicesRoutes = require('./routes/Services/services');
app.use('/api/services', servicesRoutes);

// Authentication
const authRoutes = require('./routes/LoginAuthentication/authentication');
app.use('/api/auth', authRoutes);

// Notifications
const notificationsRoutes = require('./routes/Notifications/notifications');
app.use('/api/notifications', notificationsRoutes);

// Products
const productsRoutes = require('./routes/Products/products');
app.use('/api/products', productsRoutes);

// Communications Receiver
const receiverRoutes = require('./routes/Communications/receiver-backend');
app.use('/receive', receiverRoutes);  // Adjust route prefix as needed

// Communications Sender
const senderRoutes = require('./routes/Communications/sender-backend');
app.use('/send', senderRoutes);  // Adjust route prefix as needed

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


