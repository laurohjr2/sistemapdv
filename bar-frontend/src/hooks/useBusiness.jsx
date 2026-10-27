import {createContext,useCallback,useContext,useEffect,useState} from 'react';
import api from '../lib/api';
import {useAuth} from './useAuth';
const BusinessContext=createContext(null);
const defaults={companyName:'Sistema PDV',logo:null,receiptMessage:'Obrigado pela preferência!'};
export function BusinessProvider({children}) {
  const {user}=useAuth();
  const identity=user ? `${user.company}:${user.id}` : null;
  const [selectedCompany,setSelectedCompany]=useState(localStorage.getItem('company')||'');
  useEffect(()=>{const update=()=>setSelectedCompany(localStorage.getItem('company')||'');window.addEventListener('pdv-company-change',update);return()=>window.removeEventListener('pdv-company-change',update);},[]);
  const company=user?.company || selectedCompany;
  const [business,setBusiness]=useState(defaults);
  const [businessLoading,setBusinessLoading]=useState(true);
  const [businessError,setBusinessError]=useState('');
  const refreshBusiness=useCallback(async()=>{
    const {data}=await api.get(identity?'/settings':'/settings/branding',identity?{}:{params:{company}});
    setBusiness(data);setBusinessError('');return data;
  },[identity,company]);
  useEffect(()=>{
    let active=true;
    if(!identity&&!company){setBusiness(defaults);setBusinessLoading(false);return;}
    setBusinessLoading(true);
    setBusiness(defaults);
    api.get(identity?'/settings':'/settings/branding',identity?{}:{params:{company}}).then(({data})=>{if(active){setBusiness(data);setBusinessError('');}})
      .catch(()=>{if(active)setBusinessError('Não foi possível carregar os dados do estabelecimento.');})
    .finally(()=>{if(active)setBusinessLoading(false);});
    return ()=>{active=false;};
  },[identity,company]);
  useEffect(()=>{let link=document.querySelector('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}link.href=business.logo||'/favicon.ico';},[business.logo]);
  useEffect(()=>{document.title=`${business.companyName} — PDV`;},[business.companyName]);
  return <BusinessContext.Provider value={{business,setBusiness,businessError,businessLoading,refreshBusiness}}>{children}</BusinessContext.Provider>;
}
export const useBusiness=()=>useContext(BusinessContext);
