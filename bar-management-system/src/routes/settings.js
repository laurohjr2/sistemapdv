function createRouter() {
const express = require('express');
const PDFDocument = require('pdfkit');
const {authenticateToken,authorizeRoles}=require('../middleware/auth');
const {BusinessSettings,sequelize,Comanda,Quote,PurchaseOrder,FinancialEntry,FinancialPayment}=require('../models');
const {profiles,moduleNames,effectiveModules}=require('../config/businessProfiles');
const {getSettings}=require('../services/businessSettingsService');
const {logAction}=require('../utils/auditLogger');
const router=express.Router();
const invalid=message=>Object.assign(new Error(message),{status:400});
// Inclui CNPJ numérico e o formato alfanumérico com os mesmos pesos de DV.
function validCnpj(value) {
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value) || /^(.)\1+$/.test(value)) return false;
  const digit=base=>{
    const weights=base.length===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];
    const mod=[...base].reduce((sum,char,i)=>sum+(char.charCodeAt(0)-48)*weights[i],0)%11;
    return String(mod<2?0:11-mod);
  };
  return digit(value.slice(0,12))===value[12] && digit(value.slice(0,13))===value[13];
}
function validate(body) {
  const result={};
  for(const [field,max] of Object.entries({companyName:100,legalName:150,cnpj:30,phone:40,email:150,address:250,city:100,state:2,postalCode:10,receiptMessage:200,pixKey:200})) {
    if (!(field in body)) continue;
    if(typeof body[field]!=='string' || body[field].trim().length>max) throw invalid(`Campo ${field} inválido ou muito longo.`);
    result[field]=body[field].trim();
  }
  if('companyName' in result && !result.companyName) throw invalid('Informe o nome da empresa.');
  if('cnpj' in result) {
    result.cnpj=result.cnpj.replace(/[.\/\-\s]/g,'').toUpperCase();
    if(result.cnpj && !validCnpj(result.cnpj)) throw invalid('CNPJ inválido. Confira os caracteres e os dígitos verificadores.');
  }
  if(result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw invalid('E-mail inválido.');
  if('state' in result) {
    result.state=result.state.toUpperCase();
    if(result.state && !'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(result.state)) throw invalid('UF inválida.');
  }
  if('postalCode' in result) {
    result.postalCode=result.postalCode.replace(/[\s-]/g,'');
    if(result.postalCode && !/^\d{8}$/.test(result.postalCode)) throw invalid('CEP deve conter oito números.');
  }
  for(const imageField of ['logo','pixQrCode']) {
  if(imageField in body) {
    if(body[imageField]===null) result[imageField]=null;
    else {
      if(typeof body[imageField]!=='string' || body[imageField].length>2900000) throw invalid('Logo deve ser PNG ou JPEG com até 2 MB.');
      const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body[imageField]);
      if(!match) throw invalid('Formato da logo inválido. Use PNG ou JPEG.');
      const buffer=Buffer.from(match[2],'base64');
      if(buffer.length>2*1024*1024 || buffer.toString('base64')!==match[2]) throw invalid('Logo inválida ou maior que 2 MB.');
      const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg=buffer[0]===255 && buffer[1]===216 && buffer[2]===255;
      if((match[1]==='png'&&!png)||(match[1]==='jpeg'&&!jpeg)) throw invalid('O conteúdo da logo não corresponde ao formato.');
      try {
        const image=new PDFDocument({autoFirstPage:false}).openImage(buffer);
        if(!image.width || !image.height || image.width>2048 || image.height>2048) throw new Error();
      } catch { throw invalid('Imagem inválida ou acima de 2048 × 2048 pixels.'); }
      result[imageField]=body[imageField];
    }
  }
  }
  if('businessProfile' in body){if(!profiles.some(p=>p.id===body.businessProfile))throw invalid('Perfil de negócio inválido');result.businessProfile=body.businessProfile;}
  if('modules' in body){if(!body.modules||typeof body.modules!=='object'||Array.isArray(body.modules))throw invalid('Módulos inválidos');for(const [key,value] of Object.entries(body.modules))if(!Object.hasOwn(moduleNames,key)||typeof value!=='boolean')throw invalid('Módulos inválidos');result.modules=body.modules;}
  return result;
}
// Apenas identidade visual é pública, para personalizar o login.
router.get('/branding',async(req,res,next)=>{
  try { const {companyName,logo}=await getSettings();res.json({companyName,logo}); } catch(error) {next(error);}
});
router.get('/profiles',authenticateToken,(_req,res)=>res.json({profiles,moduleNames}));
router.get('/',authenticateToken,async(req,res,next)=>{
  try {const data=await getSettings();res.json({...data,modules:effectiveModules(data),businessProfileName:(profiles.find(p=>p.id===data.businessProfile)||profiles[0]).name});} catch(error) {next(error);}
});
router.put('/',authenticateToken,authorizeRoles('admin'),express.json({limit:'6mb'}),async(req,res,next)=>{
  try {
    if(!req.body || Array.isArray(req.body)) throw invalid('Cadastro inválido.');
    const values=validate(req.body);
    const settings=await sequelize.transaction(async transaction=>{
      await sequelize.query('SELECT pg_advisory_xact_lock(882021)',{transaction});
      const [record]=await BusinessSettings.findOrCreate({where:{id:1},transaction});
      const previous=effectiveModules(record.toJSON());
      if(values.businessProfile&&values.businessProfile!==record.businessProfile&&!values.modules)values.modules=profiles.find(p=>p.id===values.businessProfile).modules;
      if(values.modules)values.modules={...previous,...values.modules};
      const next=effectiveModules({...record.toJSON(),...values});
      if(next.kitchen&&!next.tables)throw invalid('Cozinha precisa do módulo Mesas e comandas ativo.');
      if(next.purchasing&&!next.finance)throw invalid('Compras precisa do financeiro ativo para registrar as contas a pagar.');
      if((previous.tables&&!next.tables||previous.kitchen&&!next.kitchen)&&await Comanda.count({where:{status:'aberta'},transaction}))throw invalid('Finalize as comandas abertas antes de desativar mesas ou cozinha.');
      if((previous.pizza&&!next.pizza)||(previous.kitchen&&!next.kitchen)){
        const {SaleItem,Sale,ComandaItem}=require('../models'),{Op}=require('sequelize');
        const pendingSales=await SaleItem.count({where:{pizza:{[Op.ne]:null},preparationStatus:{[Op.in]:['pendente','preparando','pronto']}},include:[{model:Sale,as:'sale',where:{status:'completed'}}],transaction});
        const pendingTables=previous.pizza&&!next.pizza?await ComandaItem.count({where:{pizza:{[Op.ne]:null}},include:[{model:Comanda,as:'comanda',where:{status:'aberta'}}],transaction}):0;
        if(pendingSales||pendingTables)throw invalid('Finalize as pizzas em preparo e as comandas com pizzas antes de desativar o módulo.');
      }
      if(previous.market&&!next.market&&(await require('../models').ScaleSettings.findByPk(1,{transaction}))?.enabled)throw invalid('Desative a leitura de etiquetas de balança antes de ocultar Mercado.');
      if(previous.market&&!next.market&&await require('../models').Product.count({where:{lotTracked:true},transaction}))throw invalid('Desative o controle dos produtos com saldo zerado antes de ocultar o módulo de lotes.');
      if(previous.workshop&&!next.workshop&&await require('../models').WorkOrder.count({where:{status:['draft','waiting','approved','in_progress','ready']},transaction}))throw invalid('Conclua ou cancele as ordens de serviço antes de desativar a oficina.');
      if(previous.quotes&&!next.quotes&&await Quote.count({where:{status:['draft','sent','approved']},transaction}))throw invalid('Conclua ou cancele os orçamentos em andamento antes de desativar o módulo.');
      if(previous.purchasing&&!next.purchasing&&await PurchaseOrder.count({where:{status:['ordered','partial']},transaction}))throw invalid('Conclua os pedidos de compra em andamento antes de desativar o módulo.');
      if(previous.finance&&!next.finance){for(const entry of await FinancialEntry.findAll({where:{cancelled:false},transaction})){const paid=await FinancialPayment.sum('amount',{where:{entryId:entry.id},transaction})||0;if(Math.round(Number(entry.amount)*100)>Math.round(Number(paid)*100))throw invalid('Quite as contas pendentes antes de desativar o financeiro.');}}
      return record.update(values,{transaction});
    });
    await logAction(req.user.id,'business_settings_updated',{fields:Object.keys(values)});
    res.json({...settings.toJSON(),modules:effectiveModules(settings.toJSON()),businessProfileName:profiles.find(p=>p.id===settings.businessProfile)?.name||profiles[0].name});
  } catch(error) {
    if(error.status===400) return res.status(400).json({error:error.message});
    next(error);
  }
});
return router;

}
module.exports=require('../tenancy/scopedModule').router(createRouter);
