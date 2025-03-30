const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Basic endpoint for testing
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 