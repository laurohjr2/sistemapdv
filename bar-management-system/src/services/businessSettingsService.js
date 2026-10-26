function createScopedModule() {
const {BusinessSettings} = require('../models');
const getSettings = async () => (await BusinessSettings.findByPk(1))?.toJSON() || {
  companyName:'Sistema PDV',legalName:'',cnpj:'',phone:'',email:'',address:'',city:'',state:'',postalCode:'',receiptMessage:'Obrigado pela preferência!',logo:null
};
async function printHeader(doc) {
  const settings = await getSettings();
  if (settings.logo) {
    doc.image(Buffer.from(settings.logo.split(',')[1],'base64'),doc.page.width/2-30,doc.y,{fit:[60,50],align:'center'});
    doc.moveDown(4);
  }
  doc.fontSize(18).text(settings.companyName,{align:'center'});
  for (const line of [settings.legalName,settings.cnpj && `CNPJ: ${settings.cnpj}`,settings.address,
    [settings.city,settings.state,settings.postalCode].filter(Boolean).join(' · '),settings.phone,settings.email]) {
    if (line) doc.fontSize(10).text(line,{align:'center'});
  }
  doc.moveDown();
  return settings;
}
return {getSettings,printHeader};

}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["getSettings", "printHeader"]);
