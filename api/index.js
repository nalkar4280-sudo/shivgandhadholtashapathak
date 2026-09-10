const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Create uploads folder inside public if it doesn't exist (wrapped in try-catch to prevent crashes on Vercel's read-only system)
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("Warning: Could not create local uploads folder (this is normal on stateless servers like Vercel):", err.message);
}

const DATA_FILE = path.join(__dirname, '..', 'data', 'enrollees.json');

// Helper to read local enrollees JSON
function getLocalEnrollees() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw) || [];
    }
  } catch (err) {
    console.warn("Warning: Could not read local enrollees.json:", err.message);
  }
  return [];
}

// Helper to save local enrollees JSON
function saveLocalEnrollees(enrollees) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(enrollees, null, 2), 'utf8');
  } catch (err) {
    console.warn("Warning: Could not write local enrollees.json:", err.message);
  }
}

// Helper function to save Base64 photo to Supabase Storage and local disk backup
const savePhoto = async (id, base64Data) => {
  try {
    if (!base64Data) return;
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let imageBuffer;
    if (matches && matches.length === 3) {
      imageBuffer = Buffer.from(matches[2], 'base64');
    } else {
      imageBuffer = Buffer.from(base64Data, 'base64');
    }
    
    // Save locally as backup if server filesystem is writable
    try {
      const photoPath = path.join(UPLOADS_DIR, `${id}.jpg`);
      fs.writeFileSync(photoPath, imageBuffer);
      console.log(`Saved local backup photo for enrollee ID ${id}`);
    } catch (fsErr) {
      console.warn("Warning: Could not write local file backup (normal on Vercel):", fsErr.message);
    }

    // Upload to Supabase Storage bucket 'identity-photos'
    try {
      await supabase.storage
        .from('identity-photos')
        .upload(`${id}.jpg`, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: true
        });
    } catch (sbErr) {
      console.warn("Supabase Storage upload warning:", sbErr.message);
    }
  } catch (err) {
    console.error(`Error processing photo for enrollee ID ${id}:`, err);
  }
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Admin Authentication Config
const ADMIN_PASSWORD = 'Saurabh@2026';
const ADMIN_TOKEN = 'shivgandha-pathak-admin-token-2026';

// Initialize Supabase client
const supabaseUrl = 'https://zztmgekdjpygnaalojrc.supabase.co';
const supabaseKey = 'sb_publishable_okeZciLTaImpoCI3sfqdAw_fFZRIeXg';
const supabase = createClient(supabaseUrl, supabaseKey);

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

// API to enroll new member
app.post('/api/enroll', async (req, res) => {
  const { name, contact, age, instrument, gender, termsAccepted, parentContact, bloodGroup, photo } = req.body;

  if (!name || !contact || !age || !instrument || !gender || termsAccepted === undefined || !parentContact || !bloodGroup || !photo) {
    return res.status(400).json({ success: false, message: 'All fields are required, including identity photo' });
  }

  try {
    const enrolleeId = Date.now().toString();
    const newEnrollee = {
      id: enrolleeId,
      name: name.trim(),
      contact: contact.trim(),
      parentContact: parentContact.trim(),
      bloodGroup: bloodGroup,
      age: parseInt(age),
      instrument,
      gender,
      termsAccepted: termsAccepted,
      photoUrl: photo,
      enrolledAt: new Date().toISOString()
    };

    // 1. Save to local JSON file backup
    const localEnrollees = getLocalEnrollees();
    localEnrollees.unshift(newEnrollee);
    saveLocalEnrollees(localEnrollees);

    // 2. Save photo locally
    if (photo) {
      savePhoto(enrolleeId, photo).catch(err => console.warn("Photo save warning:", err.message));
    }

    // 3. Try saving to Supabase in background
    try {
      const enrolleeData = {
        name: name.trim(),
        contact: contact.trim(),
        age: parseInt(age),
        gender,
        instrument,
        terms_accepted: termsAccepted,
        photo: photo,
        parent_contact: parentContact.trim(),
        blood_group: bloodGroup
      };

      await supabase
        .from('enrollees')
        .insert([enrolleeData]);
    } catch (sbErr) {
      console.warn("Supabase connection warning (local copy saved):", sbErr.message);
    }

    return res.json({ success: true, message: 'Enrolled successfully!', data: newEnrollee });
  } catch (err) {
    console.error("Error saving enrollee:", err);
    res.status(500).json({ success: false, message: 'Failed to save enrollment: ' + err.message });
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
app.get('/api/enrollees', requireAdminAuth, async (req, res) => {
  let mappedData = [];

  // Try fetching from Supabase first
  try {
    const { data, error } = await supabase
      .from('enrollees')
      .select('*')
      .order('enrolled_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      mappedData = data.map(item => {
        const photoName = `${item.id}.jpg`;
        let photoUrl = null;
        if (item.photo) {
          photoUrl = item.photo;
        } else {
          const hasLocalPhoto = fs.existsSync(path.join(UPLOADS_DIR, photoName));
          if (hasLocalPhoto) {
            photoUrl = `/uploads/${photoName}`;
          } else {
            photoUrl = `https://zztmgekdjpygnaalojrc.supabase.co/storage/v1/object/public/identity-photos/${photoName}`;
          }
        }
        return {
          id: item.id,
          name: item.name,
          contact: item.contact,
          age: item.age,
          gender: item.gender,
          instrument: item.instrument,
          termsAccepted: item.terms_accepted,
          enrolledAt: item.enrolled_at,
          parentContact: item.parent_contact,
          bloodGroup: item.blood_group,
          photoUrl: photoUrl
        };
      });
    }
  } catch (err) {
    console.warn("Supabase fetch warning, falling back to local storage:", err.message);
  }

  // Fallback to / Merge with local enrollees.json
  const localEnrollees = getLocalEnrollees();
  
  if (mappedData.length === 0) {
    mappedData = localEnrollees.map(item => {
      let photoUrl = item.photoUrl || item.photo || null;
      if (!photoUrl) {
        const photoName = `${item.id}.jpg`;
        if (fs.existsSync(path.join(UPLOADS_DIR, photoName))) {
          photoUrl = `/uploads/${photoName}`;
        }
      }
      return {
        id: item.id,
        name: item.name,
        contact: item.contact,
        age: item.age,
        gender: item.gender,
        instrument: item.instrument,
        termsAccepted: item.termsAccepted,
        enrolledAt: item.enrolledAt,
        parentContact: item.parentContact,
        bloodGroup: item.bloodGroup,
        photoUrl: photoUrl
      };
    });
  } else {
    const existingIds = new Set(mappedData.map(e => String(e.id)));
    localEnrollees.forEach(item => {
      if (!existingIds.has(String(item.id))) {
        let photoUrl = item.photoUrl || item.photo || null;
        if (!photoUrl) {
          const photoName = `${item.id}.jpg`;
          if (fs.existsSync(path.join(UPLOADS_DIR, photoName))) {
            photoUrl = `/uploads/${photoName}`;
          }
        }
        mappedData.push({
          id: item.id,
          name: item.name,
          contact: item.contact,
          age: item.age,
          gender: item.gender,
          instrument: item.instrument,
          termsAccepted: item.termsAccepted,
          enrolledAt: item.enrolledAt,
          parentContact: item.parentContact,
          bloodGroup: item.bloodGroup,
          photoUrl: photoUrl
        });
      }
    });
  }

  res.json({ success: true, data: mappedData });
});

// API to delete an enrollee
app.delete('/api/enrollees/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;

  // 1. Delete from local JSON file
  const localEnrollees = getLocalEnrollees().filter(item => String(item.id) !== String(id));
  saveLocalEnrollees(localEnrollees);

  // 2. Try deleting from Supabase
  try {
    await supabase.from('enrollees').delete().eq('id', id);
  } catch (err) {
    console.warn("Supabase delete warning:", err.message);
  }

  // 3. Clean up local photo file if exists
  const photoName = `${id}.jpg`;
  const photoPath = path.join(UPLOADS_DIR, photoName);
  if (fs.existsSync(photoPath)) {
    try {
      fs.unlinkSync(photoPath);
    } catch (err) {}
  }

  res.json({ success: true, message: 'Enrollee deleted successfully' });
});

// Catch-all to serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
