// Credenciais exclusivas do desenvolvimento, geradas sem exibir valores.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const local = path.join(root, '.pdv-local');
fs.mkdirSync(local, {recursive:true,mode:0o700});
const env = path.join(local,'development.env');
if (!fs.existsSync(env)) fs.writeFileSync(env,
  `DB_HOST=127.0.0.1\nDB_NAME=bar_management\nDB_USER=postgres\nJWT_SECRET=${crypto.randomBytes(32).toString('hex')}\nDEV_ADMIN_PASSWORD=${crypto.randomBytes(18).toString('base64url')}\n`,
  {mode:0o600});
process.loadEnvFile(env);
const {User,sequelize} = require('../bar-management-system/src/models');
(async()=>{
  await sequelize.authenticate();
  await sequelize.sync();
  await require('../bar-management-system/src/migrations/queueSeating')(sequelize);
  await require('../bar-management-system/src/migrations/auditFixes')(sequelize);
  await User.findOrCreate({where:{username:'admin.dev'},defaults:{passwordHash:process.env.DEV_ADMIN_PASSWORD,role:'admin'}});
  await sequelize.close();
  console.log('Banco e administrador de desenvolvimento preparados. Credenciais em .pdv-local/development.env.');
})().catch(error=>{console.error(error.message);process.exit(1)});
