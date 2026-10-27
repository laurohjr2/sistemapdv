import {useEffect,useState} from 'react';
import {useAuth} from '../hooks/useAuth';
import {useBusiness} from '../hooks/useBusiness';
import api from '../lib/api';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Label} from '../components/ui/label';
import {Card,CardContent,CardHeader,CardTitle,CardDescription} from '../components/ui/card';
const empty={companyName:'',legalName:'',cnpj:'',phone:'',email:'',address:'',city:'',state:'',postalCode:'',receiptMessage:'',logo:null,pixKey:'',pixQrCode:null};
export default function Settings() {
  const {user}=useAuth();
  const {setBusiness}=useBusiness();
  const [form,setForm]=useState(empty);
  const [clientInfo,setClientInfo]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const editable=user?.role==='admin';
  async function load(){
    setLoading(true);setError('');
    try{const {data}=await api.get('/settings');setForm({...empty,...data});if(user?.support)setClientInfo((await api.get('/support/company-info')).data);}
    catch{setError('Não foi possível carregar as configurações. Tente novamente.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  async function logoChange(event,field='logo'){
    setError('');setSuccess('');
    const file=event.target.files?.[0];
    if(!file)return;
    event.target.value='';
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024){setError('Use uma imagem PNG ou JPEG de até 2 MB.');return;}
    try{
      const reader=new FileReader();
      const logo=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=logo;});
      if(image.width>2048||image.height>2048)throw new Error();
      setForm(previous=>({...previous,[field]:logo}));
    }catch{setError('Imagem inválida. Use até 2048 × 2048 pixels.');}
  }
  async function save(event){
    event.preventDefault();setSaving(true);setError('');setSuccess('');
    try{
      const payload=Object.fromEntries(Object.keys(empty).map(key=>[key,form[key]]));
      const {data}=await api.put('/settings',payload);
      setForm({...empty,...data});setBusiness(data);setSuccess('Configurações salvas. A identidade da empresa já foi atualizada no sistema.');
    }catch(err){setError(err.response?.data?.error||'Não foi possível salvar as configurações.');}
    finally{setSaving(false);}
  }
  if(loading)return <p role="status">Carregando configurações...</p>;
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-3xl font-bold">Configurações</h1><p className="text-muted-foreground">Dados e identidade visual do estabelecimento.</p></div>
    {error&&<div role="alert" className="rounded-md border border-red-300 p-3 text-red-700">{error} <Button type="button" variant="link" onClick={load} disabled={saving}>Recarregar dados salvos</Button></div>}
    {success&&<div role="status" className="rounded-md border border-green-300 p-3">{success}</div>}
    {!editable&&<p className="text-sm text-muted-foreground">{user?.support?'Sessão de suporte: consulta autorizada, com alterações desabilitadas.':'Você pode consultar os dados. Apenas o administrador pode alterá-los.'}</p>}
    {user?.support && clientInfo && <Card><CardHeader><CardTitle>Identificação do cliente — Suporte/Master</CardTitle></CardHeader><CardContent><Label>ID do cliente</Label><p className="mt-2 break-all font-mono" data-testid="support-client-id">{clientInfo.clientId}</p><p className="mt-2 text-sm text-muted-foreground">Visualização exclusiva ao suporte e à conta Master/Admin.</p></CardContent></Card>}
    <form onSubmit={save} className="space-y-6">
      <fieldset disabled={!editable||saving} className="space-y-6">
        <Card><CardHeader><CardTitle>Identidade da empresa</CardTitle><CardDescription>O nome e a logo aparecem no sistema e nos comprovantes.</CardDescription></CardHeader><CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-lg border bg-muted">{form.logo?<img src={form.logo} alt="Prévia da logo" className="max-h-24 max-w-24 object-contain"/>:<span className="text-3xl font-bold">{form.companyName.slice(0,1).toUpperCase()||'P'}</span>}</div>
            <div className="min-w-0 space-y-2"><Label htmlFor="logo">Logo da empresa</Label><Input id="logo" type="file" accept="image/png,image/jpeg" onChange={logoChange} className="max-w-xs"/><p className="text-xs text-muted-foreground">PNG ou JPEG · até 2 MB · até 2048 × 2048 pixels</p>{form.logo&&<Button type="button" variant="outline" onClick={()=>setForm({...form,logo:null})}>Remover logo</Button>}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[['companyName','Nome da empresa',100],['legalName','Razão social',150],['cnpj','CNPJ',30]].map(([key,label,max])=><div key={key} className="space-y-2"><Label htmlFor={key}>{label}{key==='companyName'?' *':''}</Label><Input id={key} value={form[key]} maxLength={max} required={key==='companyName'} onChange={e=>{setSuccess('');setForm({...form,[key]:e.target.value});}}/></div>)}
          </div>
          <p className="text-xs text-muted-foreground">O CNPJ é opcional. Quando informado, seus dígitos verificadores são conferidos; isso não substitui uma consulta cadastral.</p>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Contato e endereço</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          {[['phone','Telefone',40,'tel'],['email','E-mail',150,'email'],['address','Endereço e número',250,'text'],['city','Cidade',100,'text'],['state','UF',2,'text'],['postalCode','CEP',10,'text']].map(([key,label,max,type])=><div key={key} className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} type={type} value={form[key]} maxLength={max} onChange={e=>{setSuccess('');setForm({...form,[key]:e.target.value});}}/></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Recebimento por Pix</CardTitle><CardDescription>Envie o QR Code fornecido pelo banco ou informe uma chave Pix. O sistema não confirma o recebimento automaticamente.</CardDescription></CardHeader><CardContent className="space-y-3"><Label htmlFor="pixKey">Chave Pix</Label><Input id="pixKey" maxLength={200} value={form.pixKey} onChange={e=>setForm({...form,pixKey:e.target.value})}/><Label htmlFor="pixQrCode">QR Code Pix (PNG/JPEG até 2 MB)</Label><Input id="pixQrCode" type="file" accept="image/png,image/jpeg" onChange={e=>logoChange(e,'pixQrCode')}/>{form.pixQrCode&&<><img className="h-48 w-48 object-contain" src={form.pixQrCode} alt="QR Code Pix"/><Button type="button" variant="outline" onClick={()=>setForm({...form,pixQrCode:null})}>Remover QR Code</Button></>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Comprovantes</CardTitle><CardDescription>Dados usados nos comprovantes simples e PDFs; não configura emissão fiscal.</CardDescription></CardHeader><CardContent className="space-y-2"><Label htmlFor="receiptMessage">Mensagem de agradecimento</Label><Input id="receiptMessage" maxLength={200} value={form.receiptMessage} onChange={e=>setForm({...form,receiptMessage:e.target.value})}/></CardContent></Card>
        {editable&&<div className="flex justify-end"><Button type="submit">{saving?'Salvando...':'Salvar configurações'}</Button></div>}
      </fieldset>
    </form>
  </div>;
}
