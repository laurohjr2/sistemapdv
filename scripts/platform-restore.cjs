const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {readConfig,configPath}=require('../bar-management-system/src/tenancy/platform');
const {adminConnection,withPlatformLock}=require('../bar-management-system/src/tenancy/provision');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
(async()=>{
 if(!fs.existsSync(configPath()))return;
 await withPlatformLock(async()=>{
  const config=readConfig(),root=path.join(path.dirname(configPath()),'platform-backup');
  const marker=path.join(path.dirname(configPath()),'platform-restore-incomplete.json');
  if(fs.existsSync(marker))throw new Error('Restauração anterior incompleta; conferência manual necessária');
  const admin=adminConnection();
  try{
   const databases=[{key:'central',...config.central},...Object.entries(config.connections).map(([key,c])=>({key,...c}))];let restored=0;
   for(const db of databases){
    const [exists]=await admin.query('SELECT 1 FROM pg_database WHERE datname=:name',{replacements:{name:db.database}});
    const fresh=process.env.PDV_RESTORE_FRESH==='1'&&db.database==='bar_management';
    if(exists.length&&!fresh)continue;
    const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
    const item=manifest.find(m=>m.key===db.key&&m.database===db.database);if(!item||path.basename(item.file)!==item.file)throw new Error('Snapshot ausente');
    const sql=fs.readFileSync(path.join(root,item.file));if(crypto.createHash('sha256').update(sql).digest('hex')!==item.sha256)throw new Error('Snapshot inválido');
    const [roles]=await admin.query('SELECT 1 FROM pg_roles WHERE rolname=:name',{replacements:{name:db.username}});
    if(!roles.length){if(!/^[a-f0-9]{64}$/.test(db.password))throw new Error('Credencial de restauração incompatível');await admin.query(`CREATE ROLE ${quote(db.username)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${db.password}'`);}
    fs.writeFileSync(marker,JSON.stringify({database:db.database}),{mode:0o600});
    if(!exists.length)await admin.query(`CREATE DATABASE ${quote(db.database)} OWNER ${quote(db.username)}`);
    else if(fresh)await admin.query(`ALTER DATABASE ${quote(db.database)} OWNER TO ${quote(db.username)}`);
    await admin.query(`REVOKE CONNECT ON DATABASE ${quote(db.database)} FROM PUBLIC;GRANT CONNECT ON DATABASE ${quote(db.database)} TO ${quote(db.username)}`);
    execFileSync('docker',['exec','-i',process.env.PDV_POSTGRES_CONTAINER||'pdv-dev-db','psql','-v','ON_ERROR_STOP=1','-U',process.env.DB_USER||'postgres',db.database],{input:Buffer.concat([Buffer.from(`SET ROLE ${quote(db.username)};\n`),sql]),maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});fs.unlinkSync(marker);restored++;
   }
   console.log(`Restauração verificada: ${restored} bancos recuperados; bancos existentes preservados.`);
  }finally{await admin.close()}
 });
})().catch(()=>{console.error('Não foi possível restaurar a plataforma. Confira o snapshot privado antes de iniciar; nenhum banco existente foi apagado.');process.exit(1)});
