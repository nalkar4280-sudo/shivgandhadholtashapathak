const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Admin Authentication Config
const ADMIN_PASSWORD = 'pathak123';
const ADMIN_TOKEN = 'shivgandha-pathak-admin-token-2026';

// Middleware to verify admin session
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Unauthorized access. Token required.' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized access. Invalid token.' });
  }
  next();
}


const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'enrollees.json');

// Ensure data folder and file exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Read helper
function readEnrollees() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading file:", err);
    return [];
  }
}

// Write helper
function writeEnrollees(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing file:", err);
    return false;
  }
}

// API to enroll new member
app.post('/api/enroll', (req, res) => {
  const { name, contact, age, instrument, gender, termsAccepted } = req.body;

  // Basic validation
  if (!name || !contact || !age || !instrument || !gender || termsAccepted === undefined) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  const enrollees = readEnrollees();

  const newEnrollee = {
    id: Date.now().toString(),
    name: name.trim(),
    contact: contact.trim(),
    age: parseInt(age),
    instrument,
    gender,
    termsAccepted,
    enrolledAt: new Date().toISOString()
  };

  enrollees.push(newEnrollee);

  if (writeEnrollees(enrollees)) {
    res.json({ success: true, message: 'Enrolled successfully!', data: newEnrollee });
  } else {
    res.status(500).json({ success: false, message: 'Failed to save enrollment' });
  }
});

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    return res.status(401).json({ success: false, message: 'Incorrect password.' });
  }
});

// API to list all enrollees
app.get('/api/enrollees', requireAdminAuth, (req, res) => {
  const enrollees = readEnrollees();
  res.json({ success: true, data: enrollees });
});

// API to delete an enrollee
app.delete('/api/enrollees/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  let enrollees = readEnrollees();

  const originalLength = enrollees.length;
  enrollees = enrollees.filter(e => e.id !== id);

  if (enrollees.length === originalLength) {
    return res.status(404).json({ success: false, message: 'Enrollee not found' });
  }

  if (writeEnrollees(enrollees)) {
    res.json({ success: true, message: 'Enrollee deleted successfully' });
  } else {
    res.status(500).json({ success: false, message: 'Failed to delete enrollee' });
  }
});

// Catch-all to serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
