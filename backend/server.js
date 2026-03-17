const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the frontend/dist folder
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Firebase Initialization
// Note: You'll need to provide the service account key in .env or a file
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
  : null;

if (serviceAccount) {
  // Fix for private key newlines in environment variables
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.warn("Firebase Service Account not found. Firestore features will be disabled.");
}

const db = admin.apps.length ? admin.firestore() : null;

// Store for URLs to ping (Fallback if Firestore is not available)
let localUrls = [];

// API Endpoints
app.get('/', (req, res) => {
  res.send('Keep Alive Service is Running!');
});

app.get('/api/urls', async (req, res) => {
  if (db) {
    const snapshot = await db.collection('urls').get();
    const urls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(urls);
  }
  res.json(localUrls);
});

app.post('/api/urls', async (req, res) => {
  const { url, userId } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const newUrl = { url, userId, createdAt: new Date() };

  if (db) {
    const docRef = await db.collection('urls').add(newUrl);
    return res.json({ id: docRef.id, ...newUrl });
  }

  const id = Date.now().toString();
  localUrls.push({ id, ...newUrl });
  res.json({ id, ...newUrl });
});

app.delete('/api/urls/:id', async (req, res) => {
  const { id } = req.params;
  if (db) {
    await db.collection('urls').doc(id).delete();
    return res.json({ message: 'URL deleted' });
  }
  localUrls = localUrls.filter(u => u.id !== id);
  res.json({ message: 'URL deleted' });
});

// Serve frontend for any other route (fallback)
app.get('/:path(.*)', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// Pinging Logic
const pingUrls = async () => {
  console.log(`[${new Date().toISOString()}] Starting ping cycle...`);
  
  let urlsToPing = [];
  if (db) {
    const snapshot = await db.collection('urls').get();
    urlsToPing = snapshot.docs.map(doc => doc.data().url);
  } else {
    urlsToPing = localUrls.map(u => u.url);
  }

  // Add self-ping if Render URL is provided
  if (process.env.SELF_URL) {
    urlsToPing.push(process.env.SELF_URL);
  }

  for (const url of urlsToPing) {
    try {
      console.log(`Pinging: ${url}`);
      await axios.get(url);
    } catch (error) {
      console.error(`Error pinging ${url}: ${error.message}`);
    }
  }
};

// Ping every 14 minutes (14 * 60 * 1000 ms)
const PING_INTERVAL = 14 * 60 * 1000;
setInterval(pingUrls, PING_INTERVAL);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Initial ping on start
  pingUrls();
});
