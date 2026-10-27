const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {connection,configPath,platform}=require('./platform');const buildModels=require('../models/build');
const slugPattern=/^[a-z0-9][a-z0-9-]{1,62}$/;
function persist(config){const file=configPath();fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(config,null,2),{mode:0o600});fs.renameSync(tmp,file);}
function adminConnection(){return connection({database:process.env.PROVISION_DB||'postgres',username:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD||'postgres',host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||5432)})}
const quote=value=>'"'+value.replaceAll('"','""')+'"';
async function restrictedRole(admin,role,password){await admin.query(`CREATE ROLE ${quote(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);}
async function prepareDatabase(admin,database,role,password,existing=false){
 await restrictedRole(admin,role,password);
 if(!existing)await admin.query(`CREATE DATABASE ${quote(database)} OWNER ${quote(role)}`);
 await admin.query(`REVOKE CONNECT ON DATABASE ${quote(database)} FROM PUBLIC`);
 await admin.query(`GRANT CONNECT ON DATABASE ${quote(database)} TO ${quote(role)}`);
}
async function migrate(sequelize){const models=buildModels(sequelize);await sequelize.sync();await require('../migrations/queueSeating')(sequelize);await require('../migrations/auditFixes')(sequelize);await require('../migrations/customerExperience')(sequelize);return models;}
async function grantData(sequelize,role){await sequelize.query(`GRANT USAGE ON SCHEMA public TO ${quote(role)}; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${quote(role)}; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quote(role)}`);}
async function initializeUnlocked(){
 if(fs.existsSync(configPath()))return JSON.parse(fs.readFileSync(configPath(),'utf8'));
 if(fs.existsSync(path.join(path.dirname(configPath()),'platform-backup','platform.json')))throw new Error('Configuração central ausente; restaure o arquivo privado do snapshot antes de continuar');
 const admin=adminConnection();try{
 const suffix=crypto.randomBytes(6).toString('hex'),database=`pdv_central_${suffix}`,role=`pdv_c_${suffix}`,password=crypto.randomBytes(32).toString('hex');
 await prepareDatabase(admin,database,role,password);
 const config={central:{database,username:role,password,host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||5432)},connections:{}};
 const central=platform(config);try{await require('./platform').migrateCentral(central);}finally{await central.sequelize.close()}
 persist(config);return config;
 }finally{await admin.close()}
}
async function provisionUnlocked({slug,name,existingDatabase,adminUsername,adminPassword,supportPassword}){
 if(typeof slug!=='string'||!slugPattern.test(slug)||typeof name!=='string'||!name.trim()||name.trim().length>150||typeof adminUsername!=='string'||adminUsername.length<3||adminUsername.length>50||typeof adminPassword!=='string'||adminPassword.length<12)throw new Error('Informe código válido, nome, administrador e senha de ao menos 12 caracteres');
 const config=await initializeUnlocked(),central=platform(config),admin=adminConnection();
 try{
 let tenant=await central.Tenant.findOne({where:{slug}});
 if(tenant){
  // Reexecução migra com a credencial de provisionamento, nunca com o login runtime.
  const target=config.connections[tenant.connectionKey];if(!target)throw new Error('Provisionamento incompleto; confira o cadastro central');
  const elevated=connection({...target,username:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD||'postgres'});
  try{await migrate(elevated);await grantData(elevated,target.username);}finally{await elevated.close()}
  return {id:tenant.id,slug,existing:true};
 }
 const suffix=crypto.randomBytes(6).toString('hex'),database=existingDatabase||`pdv_client_${suffix}`,role=`pdv_t_${suffix}`,password=crypto.randomBytes(32).toString('hex');
 if(existingDatabase&&!/^[a-zA-Z0-9_]+$/.test(existingDatabase))throw new Error('Nome do banco legado inválido');
 if(database===config.central.database)throw new Error('O banco central não pode ser usado como banco de cliente');
 if(Object.values(config.connections).some(c=>c.database===database))throw new Error('Banco já vinculado a outra empresa');
 await prepareDatabase(admin,database,role,password,Boolean(existingDatabase));
 const elevated=connection({database,host:config.central.host,port:config.central.port,username:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD||'postgres'});
 try{const models=await migrate(elevated);await models.User.findOrCreate({where:{username:adminUsername},defaults:{passwordHash:adminPassword,role:'admin'}});await models.BusinessSettings.findOrCreate({where:{id:1},defaults:{companyName:name}});await grantData(elevated,role);}finally{await elevated.close()}
 const key=crypto.randomUUID();config.connections[key]={database,username:role,password,host:config.central.host,port:config.central.port};persist(config);
 tenant=await central.Tenant.create({slug,name,connectionKey:key});return {id:tenant.id,slug,existing:false};
 }finally{await central.sequelize.close();await admin.close()}
}
async function withPlatformLock(operation){
 const file=configPath()+'.lock';fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 let fd;try{fd=fs.openSync(file,'wx',0o600);}catch(error){if(error.code==='EEXIST')throw new Error('Outra operação da plataforma está em andamento. Confira o arquivo de lock antes de tentar novamente.');throw error;}
 try{return await operation();}finally{fs.closeSync(fd);fs.unlinkSync(file);}
}
module.exports={initializePlatform:()=>withPlatformLock(initializeUnlocked),provisionTenant:options=>withPlatformLock(()=>provisionUnlocked(options)),adminConnection,migrate,grantData,withPlatformLock};
