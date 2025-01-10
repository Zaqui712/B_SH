const express = require('express');
const app = express();
const PORT = 3001;

// Endpoint to receive request from sender backend
app.get('/receive-request', (req, res) => {
    console.log('Request received from sender backend');
    res.json({ message: 'Hello from the receiver backend!' });
});

app.listen(PORT, () => {
    console.log(`Receiver backend running on port ${PORT}`);
});
