const { WaitingQueue, sequelize } = require('../models');
const { openTable, httpError, isUuid } = require('../services/tableSeatingService');
const { logAction } = require('../utils/auditLogger');

const addToQueue = async (req, res) => {
  try {
    const { clientName, clientPhone, numberOfPeople } = req.body;

    if (typeof clientName !== 'string' || !clientName.trim() || clientName.trim().length > 100) {
      return res.status(400).json({ error: 'Informe um nome de até 100 caracteres.' });
    }
    if (!Number.isInteger(numberOfPeople) || numberOfPeople < 1) {
      return res.status(400).json({ error: 'Informe uma quantidade inteira e positiva de pessoas.' });
    }
    if (clientPhone != null && (typeof clientPhone !== 'string' || clientPhone.length > 40)) {
      return res.status(400).json({ error: 'Telefone inválido.' });
    }

    const queueEntry = await WaitingQueue.create({
      clientName: clientName.trim(),
      clientPhone: clientPhone?.trim() || null,
      numberOfPeople
    });

    await logAction(req.user.id, 'queue_entry_added', {
      queueId: queueEntry.id,
      clientName
    });

    res.status(201).json({
      message: 'Client added to waiting queue successfully',
      queueEntry
    });
  } catch (error) {
    console.error('Add to queue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getQueue = async (req, res) => {
  try {
    const { status = 'aguardando' } = req.query;
    if (!['aguardando', 'sentado', 'cancelado'].includes(status)) return res.status(400).json({ error: 'Situação inválida.' });

    const queue = await WaitingQueue.findAll({
      where: { status },
      order: [['arrivedAt', 'ASC']]
    });

    // Calculate waiting time for each entry
    const queueWithWaitTime = queue.map(entry => {
      const waitingTime = Math.floor((new Date() - new Date(entry.arrivedAt)) / (1000 * 60)); // in minutes
      return {
        ...entry.dataValues,
        waitingTimeMinutes: waitingTime
      };
    });

    res.json(queueWithWaitTime);
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const seatClient = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) throw httpError(400, 'Cliente inválido.');
    const { tableId } = req.body;
    const result = await sequelize.transaction(async transaction => {
      const queueEntry = await WaitingQueue.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!queueEntry) throw httpError(404, 'Cliente não encontrado na fila.');
      if (queueEntry.status !== 'aguardando') throw httpError(409, 'Este cliente não está mais aguardando.');
      if (!queueEntry.numberOfPeople) throw httpError(400, 'A quantidade de pessoas deste registro antigo precisa ser definida antes de acomodar.');
      const { table, comanda } = await openTable({ tableId, userId:req.user.id,
        customerName:queueEntry.clientName, customerPhone:queueEntry.clientPhone,
        numberOfPeople:queueEntry.numberOfPeople, transaction });
      await queueEntry.update({ status:'sentado', seatedAt:new Date(), tableId:table.id, comandaId:comanda.id }, { transaction });
      return { queueEntry, table, comanda };
    });
    await logAction(req.user.id, 'client_seated', { queueId:result.queueEntry.id,
      tableId:result.table.id, comandaId:result.comanda.id });
    res.json({ message:'Cliente acomodado e comanda aberta.', ...result });
  } catch (error) {
    console.error('Seat client error:', error.message);
    res.status(error.status || 500).json({error:error.status ? error.message : 'Não foi possível acomodar o cliente.'});
  }
};

const cancelQueueEntry = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) throw httpError(400, 'Cliente inválido.');
    const queueEntry = await sequelize.transaction(async transaction => {
      const entry = await WaitingQueue.findByPk(req.params.id, {transaction, lock:transaction.LOCK.UPDATE});
      if (!entry) throw httpError(404, 'Cliente não encontrado na fila.');
      if (entry.status !== 'aguardando') throw httpError(409, 'Este cliente não está mais aguardando.');
      return entry.update({status:'cancelado'}, {transaction});
    });
    await logAction(req.user.id, 'queue_entry_cancelled', {queueId:queueEntry.id});
    res.json({message:'Cliente removido da fila.',queueEntry});
  } catch (error) {
    res.status(error.status || 500).json({error:error.status ? error.message : 'Não foi possível remover o cliente.'});
  }
};

const getQueueStats = async (req, res) => {
  try {
    const totalWaiting = await WaitingQueue.count({
      where: { status: 'aguardando' }
    });

    const avgWaitTime = await WaitingQueue.findAll({
      where: { status: 'sentado' },
      attributes: ['arrivedAt', 'seatedAt'],
      raw: true
    });

    let averageWaitTimeMinutes = 0;
    if (avgWaitTime.length > 0) {
      const totalWaitTime = avgWaitTime.reduce((sum, entry) => {
        const waitTime = (new Date(entry.seatedAt) - new Date(entry.arrivedAt)) / (1000 * 60);
        return sum + waitTime;
      }, 0);
      averageWaitTimeMinutes = Math.round(totalWaitTime / avgWaitTime.length);
    }

    res.json({
      totalWaiting,
      averageWaitTimeMinutes
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  addToQueue,
  getQueue,
  seatClient,
  cancelQueueEntry,
  getQueueStats
};

