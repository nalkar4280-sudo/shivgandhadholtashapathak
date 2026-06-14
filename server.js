const express = require('express'); // Required for Vercel detection
const app = require('./api/index.js');
const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
