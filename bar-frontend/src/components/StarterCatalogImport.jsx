import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useBusiness } from "../hooks/useBusiness";
import api from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { toast } from "sonner";

export default function StarterCatalogImport({ onImported }) {
  const { user } = useAuth();
  const { business } = useBusiness();
  const [open, setOpen] = useState(false);
  const [catalogs, setCatalogs] = useState([]);
  const [profile, setProfile] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setError("");
    setCatalogs([]);
    setSelected(new Set());
    setSearch("");
    api
      .get("/products/starter-catalogs")
      .then(({ data }) => {
        if (cancelled) return;
        setCatalogs(data);
        setProfile(
          data.some((c) => c.id === business.businessProfile)
            ? business.businessProfile
            : data[0].id,
        );
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e.response?.data?.error ||
              "Não foi possível carregar os catálogos.",
          );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, business.businessProfile]);
  if (
    !["admin", "gerente"].includes(user?.role) ||
    (user?.support && !user?.master)
  )
    return null;
  const current = catalogs.find((c) => c.id === profile);
  const normalize = (text) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visible =
    current?.items.filter((item) =>
      normalize(`${item.name} ${item.category}`).includes(normalize(search)),
    ) || [];
  const available = visible.filter((item) => !item.exists);
  const toggle = (id) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const importSelected = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/products/starter-catalogs/import", {
        profile,
        itemIds: [...selected],
      });
      toast.success(
        `${data.created} ${data.created === 1 ? "item cadastrado" : "itens cadastrados"}; ${data.skipped} já existentes preservados.`,
      );
      setOpen(false);
      onImported();
    } catch (e) {
      setError(
        e.response?.data?.error || "Falha na importação. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
      <p className="font-medium">Comece com um catálogo pronto</p>
      <p className="text-sm text-muted-foreground">
        Produtos e serviços por segmento, com preços e estoque zerados. Os itens
        entram inativos para revisão e ativação.
      </p>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Importar catálogo inicial
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="grid-cols-1 sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Catálogo inicial por perfil</DialogTitle>
            <DialogDescription>
              Selecione os itens desejados. Cadastros existentes, preços e
              estoque serão preservados. Você pode combinar catálogos sem trocar
              o perfil da empresa.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm">
            Catálogo
            <select
              aria-label="Catálogo"
              className="commerce-select"
              disabled={busy}
              value={profile}
              onChange={(e) => {
                setProfile(e.target.value);
                setSelected(new Set());
                setSearch("");
              }}
            >
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.items.length} itens)
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm">
            Importados com custo R$ 0,00, preço R$ 0,00 e estoque 0. Revise
            preços, códigos e especificações antes de ativar. Serviços não
            movimentam estoque.
          </p>
          {(profile === "autopecas" || profile === "oficina") && (
            <p className="text-sm text-muted-foreground">
              Peças genéricas: preencha marca, referência e veículos compatíveis
              no cadastro. Não há aplicação veicular presumida.
            </p>
          )}
          {profile === "pizzaria" && (
            <p className="text-sm text-muted-foreground">
              As bases de pizza devem ser vinculadas aos tamanhos no menu
              Pizzaria. Sabores e preços da montagem são configurados nesse
              menu.
            </p>
          )}
          <Input
            aria-label="Buscar no catálogo"
            placeholder="Buscar nome ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !available.length}
              onClick={() =>
                setSelected(
                  (old) => new Set([...old, ...available.map((i) => i.id)]),
                )
              }
            >
              Selecionar resultados
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !selected.size}
              onClick={() => setSelected(new Set())}
            >
              Limpar seleção
            </Button>
            <span className="text-sm" role="status">
              {selected.size} selecionados · {visible.length} resultados
            </span>
          </div>
          <div className="border rounded-md max-h-[35vh] overflow-y-auto divide-y">
            {visible.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={busy || item.exists}
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                <span className="min-w-0 break-words flex-1">
                  <span className="font-medium">{item.name}</span>
                  <span className="block text-muted-foreground">
                    {item.itemType === "service" ? "Serviço" : "Produto"} ·{" "}
                    {item.unitOfMeasure} · {item.category.replaceAll("_", " ")}
                    {item.exists ? " · Já cadastrado" : ""}
                  </span>
                </span>
              </label>
            ))}
            {!busy && !visible.length && (
              <p className="p-4 text-sm">Nenhum item encontrado.</p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Fechar
            </Button>
            <Button disabled={busy || !selected.size} onClick={importSelected}>
              {busy
                ? "Aguarde..."
                : `Importar ${selected.size} ${selected.size === 1 ? "item inativo" : "itens inativos"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
