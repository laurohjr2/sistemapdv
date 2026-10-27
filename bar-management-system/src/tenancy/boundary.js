const jwt=require('jsonwebtoken');const {run}=require('./context');const TenantManager=require('./manager');
module.exports=function boundary(central){
 const manager=new TenantManager(central.config);
 const middleware=async(req,res,next)=>{
 try{
  const publicRequest=(['/api/auth/login','/api/auth/forgot-password','/api/auth/reset-password'].includes(req.path)&&req.method==='POST')||(req.path==='/api/settings/branding'&&req.method==='GET');
  let claims,where;
  if(publicRequest){const company=req.method==='POST'?req.body?.company:req.query.company;if(typeof company!=='string'||!/^[a-z0-9][a-z0-9-]{1,62}$/.test(company))return res.status(400).json({error:'Informe o código da empresa'});where={slug:company};}
  else{
   const token=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];if(!token)return res.status(401).json({error:'Faça login para continuar'});
   try{claims=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],audience:'pdv-tenant',issuer:'pdv-platform'});}catch{return res.status(401).json({error:'Sessão inválida ou expirada'});}
   if(!['tenant','support-session'].includes(claims.scope)||typeof claims.company!=='string')return res.sendStatus(401);
   where={slug:claims.company};
  }
  const tenant=await central.Tenant.findOne({where});if(!tenant)return res.status(401).json({error:'Empresa ou acesso inválido'});
  if(claims?.scope==='support-session'){
   const session=await central.SupportSession.findOne({where:{id:claims.sessionId,supportUserId:claims.supportUserId,tenantId:tenant.id,revoked:false}});
   const support=session&&await central.SupportUser.findByPk(claims.supportUserId);
   if(!session||!support?.active||claims.version!==support.updatedAt.toISOString()||session.expiresAt<=new Date())return res.sendStatus(401);
   if(!support.isMaster&&!['GET','HEAD'].includes(req.method) && !(req.method==='POST'&&req.path==='/api/support/session/end'))return res.status(403).json({error:'Acesso de suporte é somente para consulta'});
   req.supportUser=support;req.supportSession=session;
  }else if(tenant.status!=='active')return res.status(403).json({code:'COMPANY_SUSPENDED',error:'Acesso da empresa suspenso. Entre em contato com o fornecedor.'});
  req.tenant=tenant;req.platform=central;req.claims=claims;
  const lease=await manager.acquire(tenant);let released=false;const release=()=>{if(!released){released=true;lease.release()}};res.once('finish',release);res.once('close',release);
  run({tenant,models:lease.models},()=>next());
 }catch(error){console.error('Falha no contexto da empresa:',error.name);res.status(error.status||503).json({error:'Empresa temporariamente indisponível'});}
 };
 middleware.close=()=>manager.close();return middleware;
};
