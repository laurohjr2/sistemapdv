const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
process.loadEnvFile(path.resolve(__dirname,'../.pdv-local/development.env'));
const {readConfig,configPath,platform,connection}=require('../bar-management-system/src/tenancy/platform');
(async()=>{
 const original=readConfig(),root=fs.mkdtempSync(path.join(os.tmpdir(),'pdv-restore-'));fs.chmodSync(root,0o700);
 const config=JSON.parse(JSON.stringify(original));for(const db of [config.central,...Object.values(config.connections)])db.port=5433;
 fs.writeFileSync(path.join(root,'platform.json'),JSON.stringify(config),{mode:0o600});fs.cpSync(path.join(path.dirname(configPath()),'platform-backup'),path.join(root,'platform-backup'),{recursive:true});
 execFileSync(process.execPath,[path.resolve(__dirname,'platform-restore.cjs')],{env:{...process.env,PLATFORM_CONFIG_FILE:path.join(root,'platform.json'),DB_PORT:'5433',PDV_POSTGRES_CONTAINER:'pdv-restore-check',PDV_RESTORE_FRESH:'1'},stdio:['ignore','pipe','pipe']});
 const before=platform(original),after=platform(config);
 try{
 const left=await before.Tenant.findAll({order:[['slug','ASC']],raw:true}),right=await after.Tenant.findAll({order:[['slug','ASC']],raw:true});assert.deepEqual(left,right);
 for(const tenant of right){const source=connection(original.connections[tenant.connectionKey]),restored=connection(config.connections[tenant.connectionKey]);try{const [[a]]=await source.query('SELECT COUNT(*)::int AS n FROM users');const [[b]]=await restored.query('SELECT COUNT(*)::int AS n FROM users');assert.deepEqual(a,b);}finally{await source.close();await restored.close()}}
 const databases=Object.values(config.connections);const denied=connection({...databases[0],database:databases[1].database});try{await assert.rejects(()=>denied.authenticate(),e=>e.parent?.code==='42501');}finally{await denied.close()}
 fs.writeFileSync(path.resolve(__dirname,'../docs/multiempresa-20261026/restauracao.json'),JSON.stringify({status:'PASS',tenantCount:left.length,checks:['central restaurado com mesmos IDs e metadados','contagens de usuários preservadas em cada banco','credenciais individuais recuperadas','acesso cruzado continua recusado','teste realizado em instância PostgreSQL separada']},null,2));
 console.log(`Restauração aprovada: central e ${left.length} empresas, IDs preservados e isolamento mantido.`);
 }finally{await before.sequelize.close();await after.sequelize.close()}
})().catch(error=>{console.error('Teste de restauração falhou:',error.message);process.exit(1)});
