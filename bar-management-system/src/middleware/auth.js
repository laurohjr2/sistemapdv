async function authenticateToken(req,res,next){
 if(req.supportUser){req.user={id:req.supportUser.id,username:req.supportUser.username,role:'gerente',support:true};return next();}
 if(req.claims?.scope!=='tenant'||req.claims.company!==req.tenant?.slug)return res.status(401).json({error:'Sessão inválida'});
 try{const {User}=require('../models');const user=await User.findByPk(req.claims.userId);if(!user?.active)return res.status(401).json({error:'Sessão inválida'});req.user=user;next();}catch(error){next(error)}
}
const authorizeRoles=(...roles)=>(req,res,next)=>{
 if(!req.user)return res.sendStatus(401);
 if(!roles.includes(req.user.role))return res.status(403).json({error:'Permissão insuficiente'});
 next();
};
module.exports={authenticateToken,authorizeRoles};
