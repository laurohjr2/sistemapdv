const {current}=require('../tenancy/context');
module.exports=new Proxy({}, {get(_target,key){return current().models[key];}});
