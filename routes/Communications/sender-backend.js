const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

// Endpoint to send request to the receiver backend
app.get('/send-request', async (req, res) => {
    try {
        const response = await axios.get('http://localhost:3001/receive-request');
        res.json({ message: 'Request sent successfully', data: response.data });
    } catch (error) {
        console.error('Error sending request:', error);
        res.status(500).json({ message: 'Error sending request', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Sender backend running on port ${PORT}`);
});
