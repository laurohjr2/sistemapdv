function createScopedModule() {
const {revenue,summary,money}=require('../services/revenueService');
const {Product,Comanda}=require('../models');
const {Op}=require('sequelize');
const PDFDocument=require('pdfkit');
const {printHeader}=require('../services/businessSettingsService');
const handler=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e)}};
const rows=req=>revenue(req.query);
function grouped(items,key,value){const map=new Map();for(const item of items){const k=key(item);const r=map.get(k)||{name:k,quantity:0,revenue:0,count:0};r.count++;r.quantity+=item.quantity||0;r.revenue=money(r.revenue+value(item));map.set(k,r);}return [...map.values()];}
const products=data=>grouped(data.flatMap(r=>r.items),i=>i.name,i=>i.revenue).sort((a,b)=>b.revenue-a.revenue);
const sales=(data,groupBy='day')=>grouped(data,r=>{const d=new Date(r.date).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});if(groupBy==='month')return d.slice(0,7);if(groupBy==='week'){const date=new Date(d+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));return date.toISOString().slice(0,10);}return d;},r=>r.total).map(r=>({date:r.name,period:r.name,sales:r.count,totalComandas:r.count,revenue:r.revenue,totalSales:r.revenue}));
const getSalesReport=handler(async(req,res)=>res.json(sales(await rows(req),req.query.groupBy)));
const getProductConsumptionReport=handler(async(req,res)=>res.json(products(await rows(req))));
const getWaiterPerformanceReport=handler(async(req,res)=>res.json(grouped(await rows(req),r=>r.user,r=>r.total).sort((a,b)=>b.revenue-a.revenue)));
const getSalesByCategory=handler(async(req,res)=>res.json(grouped((await rows(req)).flatMap(r=>r.items),i=>i.category,i=>i.revenue).map(r=>({...r,category:r.name,value:r.revenue}))));
const getSalesByPaymentMethod=handler(async(req,res)=>res.json(grouped((await rows(req)).flatMap(r=>(r.payments||[{method:r.paymentMethod,amount:r.total}]).map(p=>({paymentMethod:p.method,total:Number(p.amount)}))),r=>r.paymentMethod,r=>r.total).map(r=>({...r,method:r.name,total:r.revenue,paymentMethod:r.name,totalRevenue:r.revenue}))));
const getSalesByHour=handler(async(req,res)=>res.json(grouped(await rows(req),r=>new Date(r.date).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit'}),r=>r.total).map(r=>({hour:r.name,sales:r.count,revenue:r.revenue}))));
const getFinancialSummary=handler(async(req,res)=>{const data=await rows(req);res.json({...summary(data),totalProducts:data.reduce((n,r)=>n+r.items.reduce((s,i)=>s+i.quantity,0),0)});});
const stock=async()=> (await Product.findAll({where:{active:true,itemType:'product',recipeEnabled:false}})).map(p=>({name:p.name,currentStock:Number(p.currentStock),minStock:Number(p.minStockAlert),status:Number(p.currentStock)<=Number(p.minStockAlert)?'Baixo':'Adequado'}));
const getStockReport=handler(async(req,res)=>res.json(await stock()));
const getDashboardData=handler(async(req,res)=>{
 const now=new Date();const localDay=now.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const data=(await revenue()).filter(r=>new Date(r.date).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})===localDay);
 const totals=summary(data);
 res.json({todaySales:{totalSales:totals.totalRevenue,totalComandas:totals.totalSales,averageTicket:totals.averageTicket},openComandas:await Comanda.count({where:{status:'aberta'}}),lowStockCount:await Product.count({where:{active:true,itemType:'product',recipeEnabled:false,currentStock:{[Op.lte]:Product.sequelize.col('min_stock_alert')}}}),topProducts:products(data).slice(0,5).map(p=>({product:{name:p.name},totalQuantity:p.quantity,totalRevenue:p.revenue}))});
});
const getComparativeReport=handler(async(req,res)=>{const {period1Start,period1End,period2Start,period2End}=req.query;if(!period1Start||!period1End||!period2Start||!period2End)return res.status(400).json({error:'Informe os dois períodos completos'});res.json({period1:summary(await revenue({startDate:period1Start,endDate:period1End})),period2:summary(await revenue({startDate:period2Start,endDate:period2End}))});});
const exportReport=handler(async(req,res)=>{
 const data=await rows(req),type=req.query.type||'sales';
 const table=type==='catalog'?(await Product.findAll({order:[['name','ASC']]})).map(p=>({'Tipo':p.itemType==='service'?'Serviço':'Produto','Produto':p.name,'Ativo':p.active?'Sim':'Não','Categoria':p.category,'Venda (R$)':Number(p.salePrice).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),'Custo (R$)':Number(p.costPrice).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),'Estoque':Number(p.currentStock)})):type==='stock'?await stock():type==='products'?products(data):type==='waiters'?grouped(data,r=>r.user,r=>r.total).sort((a,b)=>b.revenue-a.revenue).map((r,i)=>({'Posição':i+1,'Funcionário':r.name,'Operações':r.count,'Total vendido (R$)':r.revenue.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})})):type==='financial'?[summary(data)]:data.map(r=>({data:new Date(r.date).toISOString(),origem:r.origin,pagamento:(r.payments||[{method:r.paymentMethod,amount:r.total}]).map(p=>`${p.method}: ${Number(p.amount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`).join(' / '),total:r.total}));
 if(req.params.format==='csv'){
 const columns=table.length?Object.keys(table[0]):['data','origem','pagamento','total'];
 const cell=v=>{let text=String(v??'');if(/^[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'};
 res.type('text/csv').attachment('relatorio.csv').send('\uFEFF'+[columns.map(cell).join(';'),...table.map(r=>columns.map(k=>cell(r[k])).join(';'))].join('\r\n'));return;
 }
 const doc=new PDFDocument({margin:40});res.type('application/pdf').attachment('relatorio.pdf');doc.pipe(res);await printHeader(doc);doc.fontSize(14).text('Relatório de operações');doc.fontSize(10).text(`Receita: R$ ${summary(data).totalRevenue.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} · Operações: ${data.length}`);doc.moveDown();for(const row of table)doc.fontSize(9).text(Object.entries(row).map(([k,v])=>`${k}: ${v}`).join(' | '));doc.end();
});
return {getSalesReport,getProductConsumptionReport,getWaiterPerformanceReport,getSalesByCategory,getSalesByPaymentMethod,getSalesByHour,getStockReport,getFinancialSummary,getDashboardData,getComparativeReport,exportReport};

}
module.exports=require('../tenancy/scopedModule')(createScopedModule,["getSalesReport", "getProductConsumptionReport", "getWaiterPerformanceReport", "getSalesByCategory", "getSalesByPaymentMethod", "getSalesByHour", "getStockReport", "getFinancialSummary", "getDashboardData", "getComparativeReport", "exportReport"]);
