require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { sequelize } = require('./src/config/database');

// Import routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const productRoutes = require('./src/routes/products');
const stockRoutes = require('./src/routes/stock');
const tableRoutes = require('./src/routes/tables');
const comandaRoutes = require('./src/routes/comandas');
const waitingQueueRoutes = require('./src/routes/waitingQueue');
const reportRoutes = require('./src/routes/reports');
const cashRegisterRoutes = require('./src/routes/cashRegister');
const salesRoutes = require('./src/routes/sales');
// const printerRoutes = require('./src/routes/printer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(morgan('combined'));
app.use('/api/settings', require('./src/routes/settings'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/comandas', comandaRoutes);
app.use('/api/queue', require('./src/routes/queue'));
app.use('/api/waiting-queue', waitingQueueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/tickets', require('./src/routes/tickets'));
app.use('/api/print', require('./src/routes/print'));
app.use('/api/printer', require('./src/routes/printer'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Bar Management System API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({error:'A imagem é muito grande. Use uma logo de até 256 KB.'});
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync database models
    await sequelize.sync({ force: false });
    await require('./src/migrations/queueSeating')(sequelize);
    await require('./src/migrations/auditFixes')(sequelize);
    console.log('Database models synchronized.');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();

