function createRouter() {
const express = require('express');
const PDFDocument = require('pdfkit');
const {authenticateToken,authorizeRoles}=require('../middleware/auth');
const {BusinessSettings}=require('../models');
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
  for(const [field,max] of Object.entries({companyName:100,legalName:150,cnpj:30,phone:40,email:150,address:250,city:100,state:2,postalCode:10,receiptMessage:200})) {
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
  if('logo' in body) {
    if(body.logo===null) result.logo=null;
    else {
      if(typeof body.logo!=='string' || body.logo.length>360000) throw invalid('Logo deve ser PNG ou JPEG com até 256 KB.');
      const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.logo);
      if(!match) throw invalid('Formato da logo inválido. Use PNG ou JPEG.');
      const buffer=Buffer.from(match[2],'base64');
      if(buffer.length>256*1024 || buffer.toString('base64')!==match[2]) throw invalid('Logo inválida ou maior que 256 KB.');
      const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg=buffer[0]===255 && buffer[1]===216 && buffer[2]===255;
      if((match[1]==='png'&&!png)||(match[1]==='jpeg'&&!jpeg)) throw invalid('O conteúdo da logo não corresponde ao formato.');
      try {
        const image=new PDFDocument({autoFirstPage:false}).openImage(buffer);
        if(!image.width || !image.height || image.width>2048 || image.height>2048) throw new Error();
      } catch { throw invalid('Imagem inválida ou acima de 2048 × 2048 pixels.'); }
      result.logo=body.logo;
    }
  }
  return result;
}
// Apenas identidade visual é pública, para personalizar o login.
router.get('/branding',async(req,res,next)=>{
  try { const {companyName,logo}=await getSettings();res.json({companyName,logo}); } catch(error) {next(error);}
});
router.get('/',authenticateToken,async(req,res,next)=>{
  try {res.json(await getSettings());} catch(error) {next(error);}
});
router.put('/',authenticateToken,authorizeRoles('admin'),express.json({limit:'400kb'}),async(req,res,next)=>{
  try {
    if(!req.body || Array.isArray(req.body)) throw invalid('Cadastro inválido.');
    const values=validate(req.body);
    const [settings]=await BusinessSettings.findOrCreate({where:{id:1}});
    await settings.update(values);
    await logAction(req.user.id,'business_settings_updated',{fields:Object.keys(values)});
    res.json(settings);
  } catch(error) {
    if(error.status===400) return res.status(400).json({error:error.message});
    next(error);
  }
});
return router;

}
module.exports=require('../tenancy/scopedModule').router(createRouter);
