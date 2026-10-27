function createRouter() {
const router=require('express').Router();
const {authenticateToken}=require('../middleware/auth');
const {sequelize,CashRegister}=require('../models');
const {revenue,summary,money}=require('../services/revenueService');
const fail=m=>Object.assign(new Error(m),{status:400});
router.use(authenticateToken);
router.get('/status',async(req,res,next)=>{try{res.json(await CashRegister.findOne({where:{is_open:true}})||{is_open:false});}catch(e){next(e)}});
router.post('/open',async(req,res,next)=>{
 try{
 const amount=Number(req.body.opening_amount);if(req.body.opening_amount===undefined||!Number.isFinite(amount)||amount<0)throw fail('Valor inicial inválido');
 const cash=await sequelize.transaction(async transaction=>{
  await sequelize.query("SELECT pg_advisory_xact_lock(882019)",{transaction});
  if(await CashRegister.findOne({where:{is_open:true},transaction}))throw fail('Já existe um caixa aberto');
  return CashRegister.create({opened_by:req.master?req.supportUser.username:req.user.username,opening_amount:amount},{transaction});
 });res.status(201).json(cash);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
});
router.post('/close',async(req,res,next)=>{
 try{
 const amount=Number(req.body.closing_amount);if(req.body.closing_amount===undefined||!Number.isFinite(amount)||amount<0)throw fail('Valor contado inválido');
 const result=await sequelize.transaction(async transaction=>{
  const cash=await CashRegister.findOne({where:{is_open:true},transaction,lock:transaction.LOCK.UPDATE});if(!cash)throw fail('Nenhum caixa aberto');
  const totals=summary(await revenue({cashRegisterId:cash.id,transaction}));
  const moves=await require('../services/commercialOperations').cashTotals(cash.id,transaction);
  const expected=money(Number(cash.opening_amount)+totals.cashRevenue+moves.financialCashIn-moves.financialCashOut),difference=money(amount-expected);
  await cash.update({closing_amount:amount,closed_at:new Date(),is_open:false,total_sales:totals.totalRevenue,difference},{transaction});
  return {...moves,opening_amount:Number(cash.opening_amount),total_sales:totals.totalRevenue,by_payment:totals.byPayment,expected_amount:expected,closing_amount:amount,difference};
 });res.json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}
});
router.get('/report/:id',async(req,res,next)=>{try{const cash=await CashRegister.findByPk(req.params.id);if(!cash)return res.status(404).json({error:'Caixa não encontrado'});const totals=summary(await revenue({cashRegisterId:cash.id})),moves=await require('../services/commercialOperations').cashTotals(cash.id);res.json({...cash.toJSON(),...totals,...moves,expected_amount:money(Number(cash.opening_amount)+totals.cashRevenue+moves.financialCashIn-moves.financialCashOut)});}catch(e){next(e)}});
return router;

}
module.exports=require('../tenancy/scopedModule').router(createRouter);
