const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Admin Authentication Config
const ADMIN_PASSWORD = 'pathak123';
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
  const { name, contact, age, instrument, gender, termsAccepted, parentContact, bloodGroup } = req.body;

  // Basic validation
  if (!name || !contact || !age || !instrument || !gender || termsAccepted === undefined || !parentContact || !bloodGroup) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
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
        return res.json({ success: true, message: 'Enrolled successfully!', data: fallbackRes[0] });
      }
      throw error;
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

    // Map database snake_case fields back to front-end camelCase properties
    const mappedData = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      contact: item.contact,
      age: item.age,
      gender: item.gender,
      instrument: item.instrument,
      termsAccepted: item.terms_accepted,
      enrolledAt: item.enrolled_at,
      parentContact: item.parent_contact,
      bloodGroup: item.blood_group
    }));

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
