require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const {platform}=require('./src/tenancy/platform');
const central=platform();
const tenantBoundary=require('./src/tenancy/boundary')(central);

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
app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.use(express.json({limit:'6mb'}));
app.get('/api/health',async(req,res)=>{try{await central.sequelize.authenticate();res.json({status:'OK'});}catch{res.status(503).json({status:'unavailable'});}});
app.get('/api/version',(_req,res)=>res.json(require('./src/config/release.json')));
app.use('/api/support',require('./src/tenancy/supportRoutes')(central));
app.use(tenantBoundary);
app.post('/api/support/session/end',async(req,res,next)=>{try{if(!req.supportSession)return res.sendStatus(403);await req.supportSession.update({revoked:true});await central.SupportAudit.create({supportUserId:req.supportUser.id,tenantId:req.tenant.id,action:'support_session_closed'});res.sendStatus(204);}catch(e){next(e)}});
app.get('/api/support/company-info',async(req,res,next)=>{try{if(!req.supportUser)return res.sendStatus(403);await central.SupportAudit.create({supportUserId:req.supportUser.id,tenantId:req.tenant.id,action:'support_company_id_viewed'});res.json({clientId:req.tenant.id,company:req.tenant.slug});}catch(e){next(e)}});
app.use('/api/settings', require('./src/routes/settings'));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers',require('./src/routes/customers'));
app.use('/api/products', productRoutes);
app.use('/api/pizza',require('./src/routes/pizza'));
app.use('/api/autoparts',require('./src/routes/autoparts'));
app.use('/api/workshop',require('./src/routes/workshop'));
app.use('/api/commerce',require('./src/routes/commerce'));
app.use('/api/stock', stockRoutes);
app.use('/api/tables', require('./src/middleware/businessModule')('tables'), tableRoutes);
app.use('/api/comandas',require('./src/routes/comandaCustomer'));
app.use('/api/comandas', comandaRoutes);
app.use('/api/queue', require('./src/middleware/businessModule')('kitchen'), require('./src/routes/queue'));
app.use('/api/waiting-queue', require('./src/middleware/businessModule')('tables'), waitingQueueRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/tickets', require('./src/routes/tickets'));
app.use('/api/print', require('./src/routes/print'));
app.use('/api/printer', require('./src/routes/printer'));

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({error:'A imagem é muito grande. Use uma logo de até 2 MB.'});
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
    if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32)throw new Error('Configure JWT_SECRET forte no servidor');
    await central.sequelize.authenticate();
    const server=app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await tenantBoundary.close();await central.sequelize.close();process.exit(0)}));
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();

