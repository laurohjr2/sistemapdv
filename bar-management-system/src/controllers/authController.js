const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { logAction } = require('../utils/auditLogger');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    await logAction(user.id, 'login', { username });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const register = async (req, res) => {
  try {
    const { username, password, role, email, active } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const user = await User.create({
      username,
      passwordHash: password,
      email: email || '',
      active: active !== false,
      role: role || 'garcom'
    });

    if (req.user) {
      await logAction(req.user.id, 'user_created', { 
        newUserId: user.id, 
        username: user.username, 
        role: user.role 
      });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const validateToken = async (req, res) => {
  try {
    res.json({
      valid: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  login,
  register,
  validateToken
};

