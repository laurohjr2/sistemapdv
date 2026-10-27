const routerFactory=central=>{
 const router=require('express').Router(),jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs');
 const authenticate=async(req,res,next)=>{try{const token=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];const claims=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],audience:'pdv-support',issuer:'pdv-platform'});if(claims.scope!=='support')return res.sendStatus(401);const user=await central.SupportUser.findByPk(claims.supportUserId);if(!user?.active||claims.version!==user.updatedAt.toISOString())return res.sendStatus(401);req.supportUser=user;next();}catch{return res.sendStatus(401)}};
 router.post('/login',async(req,res,next)=>{try{
  const {username,password}=req.body;if(typeof username!=='string'||typeof password!=='string')return res.sendStatus(400);
  const user=await central.SupportUser.findOne({where:{username}});
  if(!user?.active||!(await bcrypt.compare(password,user.passwordHash)))return res.status(401).json({error:'Acesso de suporte inválido'});
  const token=jwt.sign({scope:'support',supportUserId:user.id,version:user.updatedAt.toISOString()},process.env.JWT_SECRET,{expiresIn:'1h',audience:'pdv-support',issuer:'pdv-platform'});
  await central.SupportAudit.create({supportUserId:user.id,action:'support_login'});res.json({token});
 }catch(e){next(e)}});
 router.get('/companies',authenticate,async(req,res,next)=>{try{res.json(await central.Tenant.findAll({attributes:['id','slug','name','status'],order:[['name','ASC']]}));}catch(e){next(e)}});
 router.post('/sessions',authenticate,async(req,res,next)=>{try{
  const tenant=await central.Tenant.findOne({where:{slug:req.body.company}});if(!tenant)return res.sendStatus(404);
  const session=await central.SupportSession.create({supportUserId:req.supportUser.id,tenantId:tenant.id,expiresAt:new Date(Date.now()+15*60000)});
  await central.SupportAudit.create({supportUserId:req.supportUser.id,tenantId:tenant.id,action:'support_session_opened'});
  const token=jwt.sign({scope:'support-session',supportUserId:req.supportUser.id,version:req.supportUser.updatedAt.toISOString(),sessionId:session.id,company:tenant.slug},process.env.JWT_SECRET,{expiresIn:'15m',audience:'pdv-tenant',issuer:'pdv-platform'});
  res.json({token,user:{id:req.supportUser.id,username:req.supportUser.username,role:req.supportUser.isMaster?'admin':'gerente',master:Boolean(req.supportUser.isMaster),support:true,company:tenant.slug}});
 }catch(e){next(e)}});
 router.delete('/sessions/:id',authenticate,async(req,res,next)=>{try{await central.SupportSession.update({revoked:true},{where:{id:req.params.id,supportUserId:req.supportUser.id}});res.sendStatus(204)}catch(e){next(e)}});
 return router;
};
module.exports=routerFactory;
