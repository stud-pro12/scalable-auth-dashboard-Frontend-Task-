const express = require('express');
const cors = require('cors');
const app = express();
const port = 4000; // Using port 4000 as requested

// Middleware to parse JSON requests
app.use(express.json());
app.use(cors()); // Allows frontend to connect to backend

// Test route
app.get('/', (req, res) => {
  res.send('Backend is running on port 4000! 🚀');
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});