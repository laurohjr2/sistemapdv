const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
// Cadastro do estabelecimento desta instalação. Não representa isolamento SaaS.
module.exports = sequelize.define('BusinessSettings', {
  id: {type:DataTypes.INTEGER,primaryKey:true,defaultValue:1},
  companyName: {type:DataTypes.STRING(100),allowNull:false,defaultValue:'Sistema PDV'},
  legalName: {type:DataTypes.STRING(150),allowNull:false,defaultValue:''},
  cnpj: {type:DataTypes.STRING(14),allowNull:false,defaultValue:''},
  phone: {type:DataTypes.STRING(40),allowNull:false,defaultValue:''},
  email: {type:DataTypes.STRING(150),allowNull:false,defaultValue:''},
  address: {type:DataTypes.STRING(250),allowNull:false,defaultValue:''},
  city: {type:DataTypes.STRING(100),allowNull:false,defaultValue:''},
  state: {type:DataTypes.STRING(2),allowNull:false,defaultValue:''},
  postalCode: {type:DataTypes.STRING(8),allowNull:false,defaultValue:''},
  receiptMessage: {type:DataTypes.STRING(200),allowNull:false,defaultValue:'Obrigado pela preferência!'},
  logo: {type:DataTypes.TEXT,allowNull:true}
}, {tableName:'business_settings',timestamps:true});
