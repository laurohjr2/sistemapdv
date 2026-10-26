const {connection}=require('./platform');const buildModels=require('../models/build');
class TenantManager{
 constructor(config){this.config=config;this.entries=new Map();this.queue=Promise.resolve();this.limit=Number(process.env.TENANT_POOL_LIMIT)||10;}
 async acquire(tenant){
  const previous=this.queue;let unlock;this.queue=new Promise(resolve=>{unlock=resolve});await previous;try{
  let entry=this.entries.get(tenant.id);
  if(!entry){
   if(this.entries.size>=this.limit){const idle=[...this.entries].filter(([,v])=>v.busy===0).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0];if(!idle)throw Object.assign(new Error('Capacidade temporariamente indisponível'),{status:503});this.entries.delete(idle[0]);await idle[1].models.sequelize.close();}
   if(!this.config.connections[tenant.connectionKey])this.config=require('./platform').readConfig();
   const config=this.config.connections[tenant.connectionKey];if(!config)throw Object.assign(new Error('Empresa indisponível'),{status:503});
   const sequelize=connection(config);entry={models:buildModels(sequelize),busy:0,lastUsed:Date.now()};this.entries.set(tenant.id,entry);
  }
  entry.busy++;return {models:entry.models,release:()=>{entry.busy--;entry.lastUsed=Date.now();}};
  }finally{unlock()}
 }
 async close(){await Promise.all([...this.entries.values()].map(e=>e.models.sequelize.close()));}
}
module.exports=TenantManager;
