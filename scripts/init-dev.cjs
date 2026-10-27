const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),local=path.join(root,'.pdv-local');fs.mkdirSync(local,{recursive:true,mode:0o700});
const env=path.join(local,'development.env');
if(!fs.existsSync(env))fs.writeFileSync(env,`DB_HOST=127.0.0.1\nDB_NAME=bar_management\nDB_USER=postgres\nJWT_SECRET=${crypto.randomBytes(32).toString('hex')}\nDEV_ADMIN_PASSWORD=${crypto.randomBytes(18).toString('base64url')}\n`,{mode:0o600});
process.loadEnvFile(env);
(async()=>{
 const {initializePlatform,provisionTenant}=require('../bar-management-system/src/tenancy/provision');
 const config=await initializePlatform();
 const central=require('../bar-management-system/src/tenancy/platform').platform(config);
 try{
  await require('../bar-management-system/src/tenancy/platform').migrateCentral(central);
  await provisionTenant({slug:process.env.DEV_COMPANY||'demo',name:'Estabelecimento de demonstração',existingDatabase:process.env.DB_NAME||'bar_management',adminUsername:'admin.dev',adminPassword:process.env.DEV_ADMIN_PASSWORD});
  await require('../bar-management-system/src/tenancy/provision').migrateAllTenants();
  if(!process.env.DEV_SUPPORT_PASSWORD){const password=crypto.randomBytes(18).toString('base64url');fs.appendFileSync(env,`DEV_SUPPORT_PASSWORD=${password}\n`);process.env.DEV_SUPPORT_PASSWORD=password;}
  await central.SupportUser.findOrCreate({where:{username:'support.dev'},defaults:{passwordHash:await require('../bar-management-system/node_modules/bcryptjs').hash(process.env.DEV_SUPPORT_PASSWORD,12)}});
  console.log('Plataforma e empresa demo preparadas. Credenciais locais protegidas em .pdv-local/development.env.');
 }finally{await central.sequelize.close()}
})().catch(error=>{console.error('Falha na preparação:',error.message);process.exit(1)});
