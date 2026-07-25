require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const app = express();
const PORT = process.env.PORT || 3000;

const SERVICES_PATH = path.join(__dirname, 'data', 'services.json');
const LEADS_PATH = path.join(__dirname, 'data', 'leads.json');

// Ensure leads.json exists
if (!fs.existsSync(LEADS_PATH)) {
  fs.writeFileSync(LEADS_PATH, '[]', 'utf-8');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Simple in-memory rate limiter (per IP) to stop form spam ---
const submissionLog = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5;
  const timestamps = (submissionLog.get(ip) || []).filter(t => now - t < windowMs);
  timestamps.push(now);
  submissionLog.set(ip, timestamps);
  return timestamps.length > maxRequests;
}

// --- GET /api/services : dynamic service catalogue ---
app.get('/api/services', (req, res) => {
  try {
    const data = fs.readFileSync(SERVICES_PATH, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Failed to read services.json', err);
    res.status(500).json({ error: 'Could not load services.' });
  }
});

// --- POST /api/contact : real working contact form ---
app.post('/api/contact', async (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
  }

  const { name, email, phone, company, service, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    phone: phone ? String(phone).slice(0, 50) : '',
    company: company ? String(company).slice(0, 200) : '',
    service: service ? String(service).slice(0, 100) : '',
    message: String(message).slice(0, 5000),
    receivedAt: new Date().toISOString(),
    ip
  };

  // 1. Persist the lead
  try {
    const existing = JSON.parse(fs.readFileSync(LEADS_PATH, 'utf-8') || '[]');
    existing.push(lead);
    fs.writeFileSync(LEADS_PATH, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist lead', err);
    return res.status(500).json({ error: 'Could not save your message. Please try again.' });
  }

  // 2. Try to email a notification (optional — only if Resend is configured)
  if (resend && process.env.TO_EMAIL) {
    try {
      const { error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'Navintrix Website <onboarding@resend.dev>',
        to: process.env.TO_EMAIL,
        replyTo: lead.email,
        subject: `New enquiry: ${lead.name}${lead.service ? ' — ' + lead.service : ''}`,
        text: `Name: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nCompany: ${lead.company}\nService: ${lead.service}\n\nMessage:\n${lead.message}`
      });
      if (error) {
        console.error('❌ Email notification failed (lead was still saved). Reason:', error);
      } else {
        console.log('✅ Email notification sent for lead', lead.id);
      }
    } catch (err) {
      // Don't fail the request just because email didn't send — the lead is already saved.
      console.error('❌ Email notification failed (lead was still saved). Full error below:');
      console.error(err);
    }
  }

  res.status(200).json({ ok: true, message: 'Thanks — we got your message and will get back to you shortly.' });
});

// --- GET /api/debug-email : manually trigger a test send, protected by ADMIN_TOKEN.
// Visit /api/debug-email?token=YOUR_ADMIN_TOKEN in a browser to see the exact error
// (or confirmation) without needing to submit the real form.
// Remove this route once email is confirmed working.
app.get('/api/debug-email', async (req, res) => {
  if (!process.env.ADMIN_TOKEN || req.query.token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Pass ?token=YOUR_ADMIN_TOKEN.' });
  }
  if (!resend || !process.env.TO_EMAIL) {
    return res.status(500).json({ error: 'RESEND_API_KEY or TO_EMAIL is missing on this server.', have: {
      RESEND_API_KEY: !!process.env.RESEND_API_KEY, TO_EMAIL: !!process.env.TO_EMAIL
    }});
  }
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Navintrix Website <onboarding@resend.dev>',
      to: process.env.TO_EMAIL,
      subject: 'Navintrix debug email',
      text: 'If you received this, email sending is working correctly.'
    });
    if (error) return res.status(500).json({ ok: false, error });
    res.json({ ok: true, message: 'Test email sent successfully — check ' + process.env.TO_EMAIL, id: data.id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- GET /api/leads : simple protected view of stored leads (basic token check) ---
app.get('/api/leads', (req, res) => {
  const token = req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Pass ?token=YOUR_ADMIN_TOKEN.' });
  }
  try {
    const leads = JSON.parse(fs.readFileSync(LEADS_PATH, 'utf-8') || '[]');
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: 'Could not read leads.' });
  }
});

// Fallback to index.html for any other route (single-page site)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Navintrix server running on http://localhost:${PORT}`);

  if (resend && process.env.TO_EMAIL) {
    console.log('✅ Resend is configured — email notifications are ON, sending to', process.env.TO_EMAIL);
  } else {
    console.warn('⚠️  RESEND_API_KEY or TO_EMAIL is missing — email notifications are OFF. Leads still save to leads.json.');
  }
});
