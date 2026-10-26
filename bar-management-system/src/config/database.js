const {current}=require('../tenancy/context');
module.exports={get sequelize(){return current().models.sequelize;}};
