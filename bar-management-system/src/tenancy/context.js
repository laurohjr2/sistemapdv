const {AsyncLocalStorage}=require('node:async_hooks');
const storage=new AsyncLocalStorage();
function current(){const context=storage.getStore();if(!context?.models)throw new Error('Operação sem empresa autorizada');return context;}
module.exports={current,run:(context,operation)=>storage.run(context,operation)};
