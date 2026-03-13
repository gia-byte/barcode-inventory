// server.js - Main Backend Server for Oriental Photographix
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'oriental-photographix-secret-key-2024';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');

// Initialize data
async function initializeData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Initialize users
    try {
      await fs.access(USERS_FILE);
    } catch {
      const defaultUsers = [{
        id: 1,
        username: 'admin',
        password: await bcrypt.hash('123456', 10),
        email: 'admin@orientalphotographix.com',
        role: 'admin',
        createdAt: new Date().toISOString()
      }];
      await fs.writeFile(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    }

    // Initialize inventory
    try {
      await fs.access(INVENTORY_FILE);
    } catch {
      const defaultInventory = [
        {
          id: 1,
          itemCode: "CAM001",
          name: "Canon EOS R5",
          category: "Camera",
          brand: "Canon",
          quantity: 15,
          unitPrice: 185000,
          minStock: 5,
          description: "Professional mirrorless camera",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      await fs.writeFile(INVENTORY_FILE, JSON.stringify(defaultInventory, null, 2));
    }

    // Initialize activity
    try {
      await fs.access(ACTIVITY_FILE);
    } catch {
      await fs.writeFile(ACTIVITY_FILE, JSON.stringify([], null, 2));
    }

    console.log('✅ Data files initialized');
  } catch (error) {
    console.error('❌ Error initializing data:', error);
  }
}

// Helper functions
async function readJSON(filePath) {
  const data = await fs.readFile(filePath, 'utf8');
  return JSON.parse(data);
}

async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function logActivity(action, details, userId = null) {
  try {
    const activities = await readJSON(ACTIVITY_FILE);
    activities.unshift({
      id: activities.length + 1,
      action,
      details,
      userId,
      timestamp: new Date().toISOString()
    });
    if (activities.length > 100) activities.pop();
    await writeJSON(ACTIVITY_FILE, activities);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

// Middleware to verify token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const users = await readJSON(USERS_FILE);
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    await logActivity('User Login', `${username} logged in`, user.id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// INVENTORY ROUTES
app.get('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const inventory = await readJSON(INVENTORY_FILE);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching inventory' });
  }
});

app.post('/api/inventory', authenticateToken, async (req, res) => {
  try {
    const inventory = await readJSON(INVENTORY_FILE);
    const { itemCode, name, category, brand, quantity, unitPrice, minStock, description } = req.body;

    if (inventory.some(i => i.itemCode === itemCode)) {
      return res.status(400).json({ error: 'Item code already exists' });
    }

    const newItem = {
      id: inventory.length > 0 ? Math.max(...inventory.map(i => i.id)) + 1 : 1,
      itemCode,
      name,
      category,
      brand: brand || '',
      quantity: parseInt(quantity),
      unitPrice: parseFloat(unitPrice),
      minStock: parseInt(minStock) || 10,
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    inventory.push(newItem);
    await writeJSON(INVENTORY_FILE, inventory);
    await logActivity('Add Item', `Added ${name}`, req.user.id);

    res.status(201).json({ success: true, item: newItem });
  } catch (error) {
    res.status(500).json({ error: 'Error adding item' });
  }
});

// DASHBOARD ROUTES
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const inventory = await readJSON(INVENTORY_FILE);
    const totalItems = inventory.length;
    const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const inStock = inventory.filter(item => item.quantity > item.minStock).length;
    const lowStock = inventory.filter(item => item.quantity > 0 && item.quantity <= item.minStock).length;
    const outOfStock = inventory.filter(item => item.quantity === 0).length;

    res.json({ totalItems, totalValue, inStock, lowStock, outOfStock });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
async function startServer() {
  await initializeData();
  
  app.listen(PORT, () => {
    console.log('===========================================');
    console.log('📷 Oriental Photographix Backend Server');
    console.log('===========================================');
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ API available at http://localhost:${PORT}/api`);
    console.log('===========================================');
    console.log('Default Login:');
    console.log('  Username: admin');
    console.log('  Password: 123456');
    console.log('===========================================');
  });
}

startServer().catch(console.error);