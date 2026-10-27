function createScopedModule() {
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { logAction } = require('../utils/auditLogger');

const generateToken = (userId, company, passwordHash) => {
  return jwt.sign({ userId, company, scope:'tenant',credentialVersion:require('node:crypto').createHash('sha256').update(passwordHash).digest('hex') }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h', audience:'pdv-tenant',issuer:'pdv-platform'
  });
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Informe usuário e senha' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !user.active || user.platformUserId) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const token = generateToken(user.id, req.tenant.slug,user.passwordHash);

    await logAction(user.id, 'login', { username });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        company:req.tenant.slug,
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
      return res.status(400).json({ error: 'Informe usuário e senha' });
    }

    if(['master.local','support.local'].includes(username.trim().toLowerCase()))return res.status(400).json({error:'Nome reservado ao acesso do fornecedor'});
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
        company:req.tenant.slug,
        role: user.role 
      });
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        company:req.tenant.slug,
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
        username: req.master?req.supportUser.username:req.user.username,
        company:req.tenant.slug,
        support:Boolean(req.supportUser),master:Boolean(req.master),
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

return {
  login,
  register,
  validateToken
};


}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["login", "register", "validateToken"]);
