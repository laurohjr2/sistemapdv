// Operações exclusivas do fornecedor. Senhas vêm do ambiente, nunca de argumentos.
const {provisionTenant,initializePlatform}=require('../bar-management-system/src/tenancy/provision');
const {platform}=require('../bar-management-system/src/tenancy/platform');
(async()=>{
 const [command,slug,name]=process.argv.slice(2);
 if(command==='create-company'){
  const result=await provisionTenant({slug,name,adminUsername:process.env.PDV_ADMIN_USERNAME||'admin',adminPassword:process.env.PDV_ADMIN_PASSWORD});
  console.log(JSON.stringify(result));return;
 }
 const central=platform(await initializePlatform());try{
 await central.sequelize.sync();
 if(command==='suspend'||command==='activate'){
  const [count]=await central.Tenant.update({status:command==='suspend'?'suspended':'active'},{where:{slug}});if(!count)throw new Error('Empresa não encontrada');console.log('Situação atualizada.');
 }else if(command==='support-user'){
  const password=process.env.PDV_SUPPORT_PASSWORD;if(!slug||!password||password.length<12)throw new Error('Informe usuário e PDV_SUPPORT_PASSWORD com ao menos 12 caracteres');
  const passwordHash=await require('../bar-management-system/node_modules/bcryptjs').hash(password,12);
  await central.sequelize.transaction(async transaction=>{const [user]=await central.SupportUser.findOrCreate({where:{username:slug},defaults:{passwordHash,active:true},transaction});await user.update({passwordHash,active:true},{transaction});await central.SupportSession.update({revoked:true},{where:{supportUserId:user.id},transaction});});console.log('Conta de suporte cadastrada; sessões anteriores revogadas.');
 }else throw new Error('Comandos: create-company <codigo> <nome>, suspend <codigo>, activate <codigo>, support-user <usuario>');
 }finally{await central.sequelize.close()}
})().catch(error=>{console.error(error.message);process.exit(1)});
