const {Sequelize,DataTypes}=require('sequelize');
const fs=require('node:fs');const path=require('node:path');
const configPath=()=>process.env.PLATFORM_CONFIG_FILE||path.resolve(__dirname,'../../../.pdv-local/platform.json');
function readConfig(){const config=JSON.parse(fs.readFileSync(configPath(),'utf8'));if(!config.central||!config.connections)throw new Error('Configuração da plataforma incompleta');return config;}
function connection(config){return new Sequelize(config.database,config.username,config.password,{host:config.host||'127.0.0.1',port:config.port||5432,dialect:'postgres',logging:false,pool:{max:3,min:0,idle:10000,acquire:15000}})}
function platform(config=readConfig()){
 const sequelize=connection(config.central);
 const Tenant=sequelize.define('Tenant',{id:{type:DataTypes.UUID,defaultValue:DataTypes.UUIDV4,primaryKey:true},slug:{type:DataTypes.STRING(63),allowNull:false,unique:true},name:{type:DataTypes.STRING(150),allowNull:false},connectionKey:{type:DataTypes.STRING(80),allowNull:false,unique:true},status:{type:DataTypes.ENUM('active','suspended'),allowNull:false,defaultValue:'active'}},{tableName:'tenants',timestamps:true});
 const SupportUser=sequelize.define('SupportUser',{id:{type:DataTypes.UUID,defaultValue:DataTypes.UUIDV4,primaryKey:true},username:{type:DataTypes.STRING,allowNull:false,unique:true},passwordHash:{type:DataTypes.STRING,allowNull:false},active:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:true},isMaster:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false}},{tableName:'support_users'});
 const SupportSession=sequelize.define('SupportSession',{id:{type:DataTypes.UUID,defaultValue:DataTypes.UUIDV4,primaryKey:true},supportUserId:{type:DataTypes.UUID,allowNull:false},tenantId:{type:DataTypes.UUID,allowNull:false},expiresAt:{type:DataTypes.DATE,allowNull:false},revoked:{type:DataTypes.BOOLEAN,allowNull:false,defaultValue:false}},{tableName:'support_sessions'});
 const SupportAudit=sequelize.define('SupportAudit',{id:{type:DataTypes.UUID,defaultValue:DataTypes.UUIDV4,primaryKey:true},supportUserId:{type:DataTypes.UUID,allowNull:false},tenantId:{type:DataTypes.UUID,allowNull:true},action:{type:DataTypes.STRING,allowNull:false}},{tableName:'support_audit'});
 return {sequelize,Tenant,SupportUser,SupportSession,SupportAudit,config};
}
async function migrateCentral(central){await central.sequelize.sync();await central.sequelize.query('ALTER TABLE support_users ADD COLUMN IF NOT EXISTS "isMaster" BOOLEAN NOT NULL DEFAULT false');}
module.exports={configPath,readConfig,connection,platform,migrateCentral};
