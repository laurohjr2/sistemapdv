// Migração aditiva: preserva entradas antigas e pode ser executada novamente.
module.exports = async function queueSeating(sequelize) {
  await sequelize.query(`ALTER TABLE waiting_queue
    ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES tables(id),
    ADD COLUMN IF NOT EXISTS comanda_id UUID REFERENCES comandas(id)`);
};
