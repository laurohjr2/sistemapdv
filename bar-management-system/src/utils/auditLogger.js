function createScopedModule() {
const { AuditLog } = require('../models');

const logAction = async (userId, action, details = null) => {
  try {
    await AuditLog.create({
      userId,
      action,
      details: details ? JSON.stringify(details) : null
    });
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
};

return {
  logAction
};


}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["logAction"]);
