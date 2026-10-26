const {current}=require('./context');
// Cache por conjunto de modelos: closures e associações nunca trocam de banco.
function scoped(factory,names){
 const modules=new WeakMap();
 const resolve=()=>{const key=current().models;let module=modules.get(key);if(!module){module=factory();modules.set(key,module)}return module};
 return Object.fromEntries(names.map(name=>[name,(...args)=>resolve()[name](...args)]));
}
scoped.router=factory=>{const routers=new WeakMap();return(req,res,next)=>{const key=current().models;let router=routers.get(key);if(!router){router=factory();routers.set(key,router)}return router(req,res,next)}};
module.exports=scoped;
