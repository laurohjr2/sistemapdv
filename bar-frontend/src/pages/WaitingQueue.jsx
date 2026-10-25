import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Clock, Plus, RefreshCw, Users } from 'lucide-react';
import api from '../lib/api';

const emptyForm = { clientName:'', clientPhone:'', numberOfPeople:'2' };
const waitingMinutes = arrivedAt => Math.max(0, Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60000));

export default function WaitingQueue() {
  const navigate = useNavigate();
  const refreshVersion = useRef(0);
  const [entries, setEntries] = useState([]);
  const [tables, setTables] = useState([]);
  const [stats, setStats] = useState({totalWaiting:0,averageWaitTimeMinutes:0});
  const [status, setStatus] = useState('aguardando');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [tableId, setTableId] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const [queueResponse, tableResponse, statsResponse] = await Promise.all([
        api.get('/waiting-queue', {params:{status}}), api.get('/tables'), api.get('/waiting-queue/stats')
      ]);
      if (version !== refreshVersion.current) return;
      setEntries(queueResponse.data);
      setTables(tableResponse.data);
      setStats(statsResponse.data);
      setError('');
    } catch {
      if (version !== refreshVersion.current) return;
      setError('Não foi possível atualizar a fila. Confira a conexão antes de continuar.');
    } finally { if (version === refreshVersion.current) setLoading(false); }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => { clearInterval(interval); refreshVersion.current++; };
  }, [refresh]);

  const availableTables = tables.filter(table => table.status === 'disponivel' && !table.comandas?.length);
  const compatibleTables = availableTables.filter(table => table.capacity >= selected?.numberOfPeople && selected?.numberOfPeople > 0);

  async function addClient(event) {
    event.preventDefault();
    setBusy(true); setActionError('');
    try {
      await api.post('/waiting-queue', {...form,numberOfPeople:Number(form.numberOfPeople)});
      setAdding(false); setForm(emptyForm);
      setNotice({message:'Cliente adicionado à fila.'});
      await refresh();
    } catch (err) { setActionError(err.response?.data?.error || 'Não foi possível adicionar o cliente.'); }
    finally { setBusy(false); }
  }

  async function seatClient(event) {
    event.preventDefault();
    setBusy(true); setActionError('');
    try {
      const {data} = await api.put(`/waiting-queue/${selected.id}/seat`, {tableId});
      setSelected(null); setTableId('');
      setNotice({message:`${data.queueEntry.clientName} acomodado na mesa ${data.table.tableNumber}. Comanda aberta.`,comandaId:data.comanda.id});
      await refresh();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Não foi possível acomodar o grupo. Confira a fila antes de tentar novamente.');
      await refresh();
    } finally { setBusy(false); }
  }

  async function cancel(entry) {
    if (!window.confirm(`Remover ${entry.clientName} da fila de espera?`)) return;
    setBusy(true);
    try {
      await api.put(`/waiting-queue/${entry.id}/cancel`);
      setNotice({message:'Cliente removido da fila.'});
      await refresh();
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível remover o cliente.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Fila de espera</h1><p className="text-muted-foreground">Clientes aguardando mesa, por ordem de chegada.</p></div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={refresh} disabled={busy}><RefreshCw className="mr-2 h-4 w-4"/>Atualizar</Button>
        <Button onClick={() => {setActionError('');setAdding(true);}}><Plus className="mr-2 h-4 w-4"/>Adicionar cliente</Button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-md border border-red-300 p-3 text-red-700">{error}</div>}
    {notice && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-green-300 p-3">
      <span>{notice.message}</span>
      {notice.comandaId && <Button onClick={() => navigate(`/comandas?comanda=${notice.comandaId}`)}>Abrir comanda</Button>}
    </div>}
    <div className="grid gap-4 sm:grid-cols-3">
      {[['Grupos aguardando',stats.totalWaiting,Users],['Mesas livres',availableTables.length,Users],['Espera média concluída',`${stats.averageWaitTimeMinutes} min`,Clock]].map(([title,value,Icon]) =>
        <Card key={title}><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-sm">{title}</CardTitle><Icon className="h-4 w-4"/></CardHeader><CardContent className="text-2xl font-bold">{value}</CardContent></Card>)}
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Situação dos clientes">
      {[['aguardando','Aguardando'],['sentado','Acomodados'],['cancelado','Cancelados']].map(([value,label]) =>
        <Button key={value} variant={status===value?'default':'outline'} onClick={() => setStatus(value)} aria-pressed={status===value}>{label}</Button>)}
    </div>
    {loading ? <p role="status">Carregando fila...</p> : entries.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">{status==='aguardando'?'Nenhum cliente aguardando mesa.':'Nenhum cliente nesta situação.'}</CardContent></Card> :
      <div className="space-y-3">{entries.map((entry,index) => <Card key={entry.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-4">
          <Badge variant="secondary">{index+1}º</Badge>
          <div><h2 className="font-semibold">{entry.clientName}</h2>
            <p className="text-sm text-muted-foreground">{entry.numberOfPeople || 'Quantidade não informada'} pessoas{entry.clientPhone ? ` · ${entry.clientPhone}`:''}</p>
            <p className="mt-1 text-sm">Chegada: {new Date(entry.arrivedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
              {status==='aguardando' ? ` · ${waitingMinutes(entry.arrivedAt)} min de espera` : entry.seatedAt ? ` · Acomodado às ${new Date(entry.seatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : ''}
              {entry.tableId ? ` · Mesa ${tables.find(table=>table.id===entry.tableId)?.tableNumber || 'vinculada'}` : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {status==='aguardando' ? <>
            <Button variant="outline" disabled={busy} onClick={()=>cancel(entry)}>Remover</Button>
            <Button disabled={busy} onClick={()=>{setActionError('');setSelected(entry);setTableId('');refresh();}}>Acomodar</Button>
          </> : entry.comandaId && <Button variant="outline" onClick={()=>navigate(`/comandas?comanda=${entry.comandaId}`)}>Ver comanda</Button>}
        </div>
      </CardContent></Card>)}</div>}
    <p className="text-xs text-muted-foreground">Atualização automática a cada 15 segundos. A disponibilidade da mesa é conferida novamente ao acomodar.</p>

    <Dialog open={adding} onOpenChange={open=>{if (!busy) setAdding(open);}}><DialogContent>
      <DialogHeader><DialogTitle>Adicionar à fila</DialogTitle><DialogDescription>Registre o responsável pelo grupo e a quantidade de pessoas.</DialogDescription></DialogHeader>
      <form onSubmit={addClient} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="clientName">Nome do cliente</Label><Input id="clientName" autoFocus required maxLength={100} value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})}/></div>
        <div className="space-y-2"><Label htmlFor="numberOfPeople">Quantidade de pessoas</Label><Input id="numberOfPeople" type="number" min="1" step="1" required value={form.numberOfPeople} onChange={e=>setForm({...form,numberOfPeople:e.target.value})}/></div>
        <div className="space-y-2"><Label htmlFor="clientPhone">Telefone (opcional)</Label><Input id="clientPhone" type="tel" maxLength={40} value={form.clientPhone} onChange={e=>setForm({...form,clientPhone:e.target.value})}/></div>
        {actionError && <p role="alert" className="text-red-700">{actionError}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setAdding(false)}>Cancelar</Button><Button disabled={busy}>{busy?'Salvando...':'Adicionar à fila'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
    <Dialog open={Boolean(selected)} onOpenChange={open=>{if (!open && !busy) setSelected(null);}}><DialogContent>
      <DialogHeader><DialogTitle>Acomodar {selected?.clientName}</DialogTitle><DialogDescription>Escolha uma mesa para {selected?.numberOfPeople} pessoas. A comanda será aberta automaticamente.</DialogDescription></DialogHeader>
      <form onSubmit={seatClient} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="seatingTable">Mesa disponível</Label>
          <select id="seatingTable" className="h-10 w-full rounded-md border bg-background px-3 text-sm" required value={tableId} onChange={e=>setTableId(e.target.value)}>
            <option value="">Selecione uma mesa</option>
            {compatibleTables.map(table=><option key={table.id} value={table.id}>Mesa {table.tableNumber} — {table.capacity} lugares</option>)}
          </select>
        </div>
        {!compatibleTables.length && <p className="text-sm text-muted-foreground">Nenhuma mesa livre com capacidade suficiente. Cadastre a capacidade das mesas ou aguarde uma liberação.</p>}
        {actionError && <p role="alert" className="text-red-700">{actionError}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setSelected(null)}>Voltar</Button><Button disabled={busy || !compatibleTables.some(table=>table.id===tableId)}>{busy?'Acomodando...':'Acomodar e abrir comanda'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>;
}
