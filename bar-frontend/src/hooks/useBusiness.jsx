import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import api from '../lib/api';
import {useAuth} from './useAuth';
const BusinessContext=createContext(null);
const defaults={companyName:'Sistema PDV',logo:null,receiptMessage:'Obrigado pela preferência!'};
export function BusinessProvider({children}) {
  const {user}=useAuth();
  const [business,setBusiness]=useState(defaults);
  const [businessError,setBusinessError]=useState('');
  const refreshBusiness=useCallback(async()=>{
    const {data}=await api.get(user?'/settings':'/settings/branding');
    setBusiness(data);setBusinessError('');return data;
  },[user?.id]);
  useEffect(()=>{
    let active=true;
    setBusiness(defaults);
    api.get(user?'/settings':'/settings/branding').then(({data})=>{if(active){setBusiness(data);setBusinessError('');}})
      .catch(()=>{if(active)setBusinessError('Não foi possível carregar os dados do estabelecimento.');});
    return ()=>{active=false;};
  },[user?.id]);
  useEffect(()=>{document.title=`${business.companyName} — PDV`;},[business.companyName]);
  return <BusinessContext.Provider value={{business,setBusiness,businessError,refreshBusiness}}>{children}</BusinessContext.Provider>;
}
export const useBusiness=()=>useContext(BusinessContext);
