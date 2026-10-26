const router=require('express').Router();
const {authenticateToken}=require('../middleware/auth');
const {generateComandaReceipt}=require('../controllers/printController');
const {printHeader}=require('../services/businessSettingsService');
router.use(authenticateToken);
router.post('/comanda/:id',generateComandaReceipt);
router.post('/receipt/:id',generateComandaReceipt);
// Documento de teste, sem alegar que uma impressora física o recebeu.
router.post('/test',async(req,res,next)=>{try{const doc=new(require('pdfkit'))({size:[226,400],margin:12});res.type('application/pdf');doc.pipe(res);await printHeader(doc);doc.fontSize(12).text('TESTE DE IMPRESSÃO',{align:'center'});doc.fontSize(9).text('Abra este PDF e selecione a impressora no diálogo do Windows.');doc.end();}catch(e){next(e)}});
module.exports=router;
