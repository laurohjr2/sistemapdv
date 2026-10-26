// Snapshot privado para desenvolvimento. Nunca imprime dados ou credenciais.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {readConfig,configPath}=require('../bar-management-system/src/tenancy/platform');
const {withPlatformLock}=require('../bar-management-system/src/tenancy/provision');
(async()=>withPlatformLock(async()=>{
 const config=readConfig(),root=path.join(path.dirname(configPath()),'platform-backup'),temp=root+'.tmp';
 fs.mkdirSync(temp,{recursive:true,mode:0o700});
 const databases=[{key:'central',...config.central},...Object.entries(config.connections).map(([key,c])=>({key,...c}))];
 fs.writeFileSync(path.join(temp,'platform.json'),JSON.stringify(config,null,2),{mode:0o600});
 const manifest=[];
 for(const db of databases){
  const sql=execFileSync('docker',['exec',process.env.PDV_POSTGRES_CONTAINER||'pdv-dev-db','pg_dump','-U',process.env.DB_USER||'postgres','--no-owner',db.database],{maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
  const file=db.key+'.sql';fs.writeFileSync(path.join(temp,file),sql,{mode:0o600});manifest.push({file,key:db.key,database:db.database,sha256:crypto.createHash('sha256').update(sql).digest('hex')});
 }
 fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
 const previous=root+'.previous';if(fs.existsSync(previous))fs.rmSync(previous,{recursive:true});if(fs.existsSync(root))fs.renameSync(root,previous);fs.renameSync(temp,root);
 console.log(`Snapshot privado concluído: banco central e ${databases.length-1} bancos de clientes.`);
}))().catch(()=>{console.error('Falha no backup. Snapshot anterior preservado; confira Docker, acesso PostgreSQL e espaço local.');process.exit(1)});
