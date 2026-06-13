const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3005;

// Create uploads folder inside public if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper function to save Base64 photo to Supabase Storage and local disk backup
const savePhoto = async (id, base64Data) => {
  try {
    if (!base64Data) return;
    // Strip out the data URL scheme if present
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let imageBuffer;
    if (matches && matches.length === 3) {
      imageBuffer = Buffer.from(matches[2], 'base64');
    } else {
      imageBuffer = Buffer.from(base64Data, 'base64');
    }
    
    // 1. Save locally as backup if server filesystem is writable
    try {
      const photoPath = path.join(UPLOADS_DIR, `${id}.jpg`);
      fs.writeFileSync(photoPath, imageBuffer);
      console.log(`Saved local backup photo for enrollee ID ${id}`);
    } catch (fsErr) {
      console.warn(`Warning: Could not write local file backup (normal on Vercel):`, fsErr.message);
    }

    // 2. Upload to Supabase Storage bucket 'identity-photos'
    const { data, error } = await supabase.storage
      .from('identity-photos')
      .upload(`${id}.jpg`, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error(`Error uploading photo to Supabase Storage for ID ${id}:`, error.message);
    } else {
      console.log(`Successfully uploaded photo to Supabase Storage for ID ${id}`);
    }
  } catch (err) {
    console.error(`Error processing photo for enrollee ID ${id}:`, err);
  }
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Admin Authentication Config
const ADMIN_PASSWORD = 'pathak123';
const ADMIN_TOKEN = 'shivgandha-pathak-admin-token-2026';

// Initialize Supabase client
const supabaseUrl = 'https://zztmgekdjpygnaalojrc.supabase.co';
const supabaseKey = 'sb_publishable_okeZciLTaImpoCI3sfqdAw_fFZRIeXg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Attempt to initialize storage bucket programmatically
const initBucket = async () => {
  try {
    const { data, error } = await supabase.storage.createBucket('identity-photos', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png']
    });
    if (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log("Supabase storage bucket 'identity-photos' already exists.");
      } else {
        console.warn("Warning: Could not create Supabase storage bucket programmatically:", error.message);
      }
    } else {
      console.log("Successfully created Supabase storage bucket 'identity-photos'.");
    }
  } catch (err) {
    console.warn("Warning: Failed programmatically creating Supabase bucket:", err.message);
  }
};
initBucket();

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

  // Basic validation (photo is required for identity validation)
  if (!name || !contact || !age || !instrument || !gender || termsAccepted === undefined || !parentContact || !bloodGroup || !photo) {
    return res.status(400).json({ success: false, message: 'All fields are required, including identity photo' });
  }

  try {
    const enrolleeData = {
      name: name.trim(),
      contact: contact.trim(),
      age: parseInt(age),
      gender,
      instrument,
      terms_accepted: termsAccepted
    };

    if (parentContact) {
      enrolleeData.parent_contact = parentContact.trim();
    }
    if (bloodGroup) {
      enrolleeData.blood_group = bloodGroup;
    }

    const { data, error } = await supabase
      .from('enrollees')
      .insert([enrolleeData])
      .select();

    if (error) {
      // Handle schema column missing error code 42703
      if (error.code === '42703' || (error.message && error.message.toLowerCase().includes('column'))) {
        console.warn("Warning: Supabase table 'enrollees' is missing parent_contact or blood_group columns. Falling back to default fields.");
        const fallbackData = {
          name: name.trim(),
          contact: contact.trim(),
          age: parseInt(age),
          gender,
          instrument,
          terms_accepted: termsAccepted
        };
        const { data: fallbackRes, error: fallbackErr } = await supabase
          .from('enrollees')
          .insert([fallbackData])
          .select();

        if (fallbackErr) throw fallbackErr;
        
        if (photo && fallbackRes && fallbackRes[0]) {
          await savePhoto(fallbackRes[0].id, photo);
        }
        
        return res.json({ success: true, message: 'Enrolled successfully!', data: fallbackRes[0] });
      }
      throw error;
    }

    if (photo && data && data[0]) {
      await savePhoto(data[0].id, photo);
    }

    res.json({ success: true, message: 'Enrolled successfully!', data: data[0] });
  } catch (err) {
    console.error("Error inserting enrollee into Supabase:", err);
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
  try {
    const { data, error } = await supabase
      .from('enrollees')
      .select('*')
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    // Fetch existing files in the 'identity-photos' storage bucket to check presence
    let storageFiles = [];
    try {
      const { data: listData, error: listError } = await supabase.storage
        .from('identity-photos')
        .list('', { limit: 1000 });
      if (!listError && listData) {
        storageFiles = listData.map(f => f.name);
      }
    } catch (storageErr) {
      console.warn("Warning: Could not list files from Supabase Storage:", storageErr.message);
    }

    // Map database snake_case fields back to front-end camelCase properties
    const mappedData = (data || []).map(item => {
      const photoName = `${item.id}.jpg`;
      const hasStoragePhoto = storageFiles.includes(photoName);
      
      let photoUrl = null;
      if (hasStoragePhoto) {
        photoUrl = `https://zztmgekdjpygnaalojrc.supabase.co/storage/v1/object/public/identity-photos/${photoName}`;
      } else {
        // Fallback to check local filesystem
        const hasLocalPhoto = fs.existsSync(path.join(UPLOADS_DIR, photoName));
        if (hasLocalPhoto) {
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
        termsAccepted: item.terms_accepted,
        enrolledAt: item.enrolled_at,
        parentContact: item.parent_contact,
        bloodGroup: item.blood_group,
        photoUrl: photoUrl
      };
    });

    res.json({ success: true, data: mappedData });
  } catch (err) {
    console.error("Error fetching enrollees from Supabase:", err);
    res.status(500).json({ success: false, message: 'Failed to fetch enrollees: ' + err.message });
  }
});

// API to delete an enrollee
app.delete('/api/enrollees/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('enrollees')
      .delete()
      .eq('id', id);

    if (error) throw error;

    const photoName = `${id}.jpg`;

    // 1. Delete from Supabase Storage
    try {
      const { error: storageDelError } = await supabase.storage
        .from('identity-photos')
        .remove([photoName]);
      if (storageDelError) {
        console.error(`Error deleting photo from Supabase Storage:`, storageDelError.message);
      } else {
        console.log(`Deleted photo from Supabase Storage for ID ${id}`);
      }
    } catch (storageErr) {
      console.error(`Failed to connect to Supabase Storage for deletion:`, storageErr.message);
    }

    // 2. Clean up local backup photo file if it exists
    const photoPath = path.join(UPLOADS_DIR, photoName);
    if (fs.existsSync(photoPath)) {
      try {
        fs.unlinkSync(photoPath);
        console.log(`Deleted local photo backup for enrollee ID ${id}`);
      } catch (err) {
        console.error(`Error deleting local photo backup for ID ${id}:`, err);
      }
    }

    res.json({ success: true, message: 'Enrollee deleted successfully' });
  } catch (err) {
    console.error("Error deleting enrollee from Supabase:", err);
    res.status(500).json({ success: false, message: 'Failed to delete enrollee: ' + err.message });
  }
});

// Catch-all to serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
