import { useEffect, useState } from "react";
import { api, getCredentials, CLOUDFLARE_ACCOUNT_ID } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CodeIcon, PlusIcon, Trash2Icon, RefreshCwIcon, EyeIcon,
  Loader2, ClockIcon, PencilIcon, GlobeIcon, LinkIcon, Route
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Worker {
  id: string;
  script_name?: string;
  created_on: string;
  modified_on: string;
  usage_model?: string;
  etag?: string;
}

interface WorkerDomain {
  id?: string;
  hostname: string;
  service?: string;
  environment?: string;
  zone_id?: string;
  zone_name?: string;
}

interface WorkerRoute {
  id: string;
  pattern: string;
  script?: string;
}

interface Zone {
  id: string;
  name: string;
}

const DEFAULT_SCRIPT = `export default {
  async fetch(request, env, ctx) {
    return new Response('Hello from Cloudflare Worker!', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
`;

type DialogMode = "add" | "edit" | "view";

export default function WorkersPage() {
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState(CLOUDFLARE_ACCOUNT_ID);

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const [formName, setFormName] = useState("");
  const [formScript, setFormScript] = useState(DEFAULT_SCRIPT);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteWorker, setDeleteWorker] = useState<Worker | null>(null);

  // Custom domain management
  const [domainWorker, setDomainWorker] = useState<Worker | null>(null);
  const [domains, setDomains] = useState<WorkerDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [newDomainHostname, setNewDomainHostname] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [deleteDomain, setDeleteDomain] = useState<WorkerDomain | null>(null);

  // Routes management
  const [zones, setZones] = useState<Zone[]>([]);
  const [routes, setRoutes] = useState<WorkerRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [newRoutePattern, setNewRoutePattern] = useState("");
  const [addingRoute, setAddingRoute] = useState(false);
  const [deleteRoute, setDeleteRoute] = useState<{ route: WorkerRoute; zoneId: string } | null>(null);
  const [routesTab, setRoutesTab] = useState("domains");

  const fetchWorkers = async (accId?: string) => {
    setLoading(true);
    const aid = accId ?? accountId;
    const res = await api.get(`/accounts/${aid}/workers/scripts`);
    if (res.ok) setWorkers((res.data as { result: Worker[] }).result ?? []);
    setLoading(false);
  };

  const fetchZones = async () => {
    const res = await api.get("/zones?per_page=50");
    if (res.ok) setZones((res.data as { result: Zone[] }).result ?? []);
  };

  useEffect(() => { fetchWorkers(); fetchZones(); }, []);

  const openAdd = () => {
    setSelectedWorker(null);
    setFormName("");
    setFormScript(DEFAULT_SCRIPT);
    setDialogMode("add");
  };

  const openEdit = async (worker: Worker) => {
    const name = worker.id ?? worker.script_name ?? "";
    setSelectedWorker(worker);
    setFormName(name);
    setFormScript("");
    setDialogMode("edit");
    setFormLoading(true);
    try {
      const res = await api.getText(`/accounts/${accountId}/workers/scripts/${name}`);
      setFormScript(res.ok && res.data ? res.data : "// Gagal memuat script. Tulis ulang script di sini.");
    } catch {
      setFormScript("// Gagal memuat script. Tulis ulang script di sini.");
    }
    setFormLoading(false);
  };

  const openView = async (worker: Worker) => {
    const name = worker.id ?? worker.script_name ?? "";
    setSelectedWorker(worker);
    setFormScript("");
    setDialogMode("view");
    setFormLoading(true);
    try {
      const res = await api.getText(`/accounts/${accountId}/workers/scripts/${name}`);
      setFormScript(res.ok && res.data ? res.data : "// Tidak dapat memuat script");
    } catch {
      setFormScript("// Tidak dapat memuat script");
    }
    setFormLoading(false);
  };

  const openDomainManager = async (worker: Worker) => {
    setDomainWorker(worker);
    setRoutesTab("domains");
    setNewDomainHostname("");
    setNewRoutePattern("");
    setSelectedZoneId(zones[0]?.id ?? "");
    loadDomains(worker);
  };

  const loadDomains = async (worker: Worker) => {
    const name = worker.id ?? worker.script_name ?? "";
    setDomainsLoading(true);
    setDomains([]);
    const res = await api.get(`/accounts/${accountId}/workers/scripts/${name}/domains`);
    if (res.ok) setDomains((res.data as { result: WorkerDomain[] }).result ?? []);
    setDomainsLoading(false);
  };

  const loadRoutes = async (zoneId: string) => {
    if (!zoneId) return;
    setRoutesLoading(true);
    setRoutes([]);
    const res = await api.get(`/zones/${zoneId}/workers/routes`);
    if (res.ok) {
      const all = (res.data as { result: WorkerRoute[] }).result ?? [];
      const workerName = domainWorker?.id ?? domainWorker?.script_name ?? "";
      setRoutes(all.filter((r) => r.script === workerName));
    }
    setRoutesLoading(false);
  };

  const addDomain = async () => {
    if (!newDomainHostname.trim() || !domainWorker) return;
    const name = domainWorker.id ?? domainWorker.script_name ?? "";
    setAddingDomain(true);
    const res = await api.put(`/accounts/${accountId}/workers/scripts/${name}/domains`, [
      { hostname: newDomainHostname.trim(), service: name, environment: "production" }
    ]);
    if (res.ok) {
      toast({ title: `Domain ${newDomainHostname} berhasil ditambahkan` });
      setNewDomainHostname("");
      loadDomains(domainWorker);
    } else {
      toast({ title: "Gagal menambah domain", variant: "destructive" });
    }
    setAddingDomain(false);
  };

  const confirmDeleteDomain = async () => {
    if (!deleteDomain || !domainWorker) return;
    const name = domainWorker.id ?? domainWorker.script_name ?? "";
    const res = await api.delete(`/accounts/${accountId}/workers/scripts/${name}/domains/${deleteDomain.hostname}`);
    if (res.ok) {
      toast({ title: `Domain ${deleteDomain.hostname} dihapus` });
      setDomains((d) => d.filter((x) => x.hostname !== deleteDomain.hostname));
    } else {
      toast({ title: "Gagal menghapus domain", variant: "destructive" });
    }
    setDeleteDomain(null);
  };

  const addRoute = async () => {
    if (!newRoutePattern.trim() || !selectedZoneId || !domainWorker) return;
    const workerName = domainWorker.id ?? domainWorker.script_name ?? "";
    setAddingRoute(true);
    const res = await api.post(`/zones/${selectedZoneId}/workers/routes`, {
      pattern: newRoutePattern.trim(),
      script: workerName,
    });
    if (res.ok) {
      toast({ title: `Route "${newRoutePattern}" berhasil ditambahkan` });
      setNewRoutePattern("");
      loadRoutes(selectedZoneId);
    } else {
      toast({ title: "Gagal menambah route", variant: "destructive" });
    }
    setAddingRoute(false);
  };

  const confirmDeleteRoute = async () => {
    if (!deleteRoute) return;
    const res = await api.delete(`/zones/${deleteRoute.zoneId}/workers/routes/${deleteRoute.route.id}`);
    if (res.ok) {
      toast({ title: `Route "${deleteRoute.route.pattern}" dihapus` });
      setRoutes((r) => r.filter((x) => x.id !== deleteRoute.route.id));
    } else {
      toast({ title: "Gagal menghapus route", variant: "destructive" });
    }
    setDeleteRoute(null);
  };

  const saveWorker = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    const formData = new FormData();
    const blob = new Blob([formScript], { type: "application/javascript" });
    formData.append("script", blob, "worker.js");

    try {
      const creds = getCredentials();
      const authHeader = creds ? "Basic " + btoa(`${creds.username}:${creds.password}`) : "";
      const res = await fetch(`https://panelv1.elfar.my.id/accounts/${accountId}/workers/scripts/${formName.trim()}`, {
        method: "PUT",
        headers: { Authorization: authHeader },
        body: formData,
      });
      if (res.ok) {
        toast({ title: dialogMode === "edit" ? `Worker "${formName}" diperbarui` : `Worker "${formName}" berhasil di-deploy` });
        setDialogMode(null);
        fetchWorkers(accountId);
      } else {
        const errText = await res.text();
        toast({ title: "Gagal menyimpan worker", description: errText.slice(0, 120), variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menghubungi API", variant: "destructive" });
    }
    setSaving(false);
  };

  const deleteWorkerConfirm = async () => {
    if (!deleteWorker) return;
    const name = deleteWorker.id ?? deleteWorker.script_name;
    const res = await api.delete(`/accounts/${accountId}/workers/scripts/${name}`);
    if (res.ok) {
      toast({ title: `Worker "${name}" dihapus` });
      setWorkers((p) => p.filter((w) => w.id !== deleteWorker.id));
    } else {
      toast({ title: "Gagal menghapus worker", variant: "destructive" });
    }
    setDeleteWorker(null);
  };

  const isEditAdd = dialogMode === "add" || dialogMode === "edit";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Workers & Scripts</h1>
          <p className="text-gray-400 text-sm mt-1">{workers.length} worker aktif</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => fetchWorkers()} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <RefreshCwIcon className="w-4 h-4" /> Refresh
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-orange-500 hover:bg-orange-600 gap-1.5">
            <PlusIcon className="w-4 h-4" /> Worker Baru
          </Button>
        </div>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-gray-800" />)}</div>
          ) : workers.length === 0 ? (
            <div className="text-center py-12">
              <CodeIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Belum ada Worker script</p>
              <p className="text-xs text-gray-600 mt-1">Klik "Worker Baru" untuk deploy script</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {workers.map((worker) => {
                const name = worker.id ?? worker.script_name ?? "unknown";
                return (
                  <div key={worker.id} className="flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <CodeIcon className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{name}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {formatDate(worker.modified_on)}
                          </p>
                          {worker.usage_model && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">{worker.usage_model}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
                        onClick={() => openView(worker)}
                        title="Lihat script"
                      >
                        <EyeIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10"
                        onClick={() => openEdit(worker)}
                        title="Edit script"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
                        onClick={() => openDomainManager(worker)}
                        title="Kelola custom domain & routes"
                      >
                        <GlobeIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setDeleteWorker(worker)}
                        title="Hapus worker"
                      >
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={isEditAdd} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CodeIcon className="w-4 h-4 text-purple-400" />
              {dialogMode === "edit" ? `Edit Worker: ${formName}` : "Deploy Worker Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Nama Worker</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="my-worker"
                disabled={dialogMode === "edit"}
                className="bg-gray-800 border-gray-700 text-white font-mono disabled:opacity-60"
              />
              {dialogMode === "edit" && (
                <p className="text-xs text-gray-500">Nama tidak bisa diubah saat edit. Deploy baru untuk nama berbeda.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Script (JavaScript / ES Module)</Label>
              {formLoading ? (
                <div className="flex items-center justify-center py-10 bg-gray-950 rounded-lg border border-gray-700">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
                  <span className="text-gray-400 text-sm">Memuat script...</span>
                </div>
              ) : (
                <textarea
                  value={formScript}
                  onChange={(e) => setFormScript(e.target.value)}
                  rows={14}
                  className="w-full rounded-lg bg-gray-950 border border-gray-700 text-green-400 font-mono text-xs p-3 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-y"
                />
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setDialogMode(null)} className="text-gray-400 w-full sm:w-auto">Batal</Button>
            <Button
              onClick={saveWorker}
              disabled={saving || !formName.trim() || formLoading}
              className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dialogMode === "edit" ? "Simpan Perubahan" : "Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View script dialog */}
      <Dialog open={dialogMode === "view"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl w-[95vw] max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CodeIcon className="w-4 h-4 text-purple-400" />
              {selectedWorker?.id ?? selectedWorker?.script_name}
            </DialogTitle>
          </DialogHeader>
          {formLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <pre className="text-xs text-green-400 bg-gray-950 rounded-lg p-4 overflow-auto font-mono leading-relaxed whitespace-pre-wrap">
              {formScript}
            </pre>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => selectedWorker && openEdit(selectedWorker)}
              className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-2"
            >
              <PencilIcon className="w-4 h-4" /> Edit Script Ini
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Domain & Routes Manager */}
      <Dialog open={!!domainWorker} onOpenChange={(o) => !o && setDomainWorker(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GlobeIcon className="w-4 h-4 text-blue-400" />
              Domain & Routes — {domainWorker?.id ?? domainWorker?.script_name}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={routesTab} onValueChange={(v) => {
            setRoutesTab(v);
            if (v === "routes" && selectedZoneId) loadRoutes(selectedZoneId);
          }}>
            <TabsList className="bg-gray-800 border border-gray-700 w-full">
              <TabsTrigger value="domains" className="flex-1 data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" /> Custom Domain
              </TabsTrigger>
              <TabsTrigger value="routes" className="flex-1 data-[state=active]:bg-gray-700 text-gray-400 data-[state=active]:text-white gap-1.5">
                <Route className="w-3.5 h-3.5" /> Routes
              </TabsTrigger>
            </TabsList>

            {/* Custom Domains Tab */}
            <TabsContent value="domains" className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">Tambah domain kustom langsung ke worker ini (misal: api.example.com)</p>
              <div className="flex gap-2">
                <Input
                  placeholder="api.example.com"
                  value={newDomainHostname}
                  onChange={(e) => setNewDomainHostname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDomain()}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1"
                />
                <Button onClick={addDomain} disabled={addingDomain || !newDomainHostname.trim()} className="bg-orange-500 hover:bg-orange-600 shrink-0">
                  {addingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {domainsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : domains.length === 0 ? (
                  <div className="text-center py-8">
                    <LinkIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Belum ada custom domain</p>
                  </div>
                ) : (
                  domains.map((d) => (
                    <div key={d.hostname} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{d.hostname}</p>
                        {d.zone_name && <p className="text-xs text-gray-500">{d.zone_name}</p>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                        onClick={() => setDeleteDomain(d)}>
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Routes Tab */}
            <TabsContent value="routes" className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">Tambah route pola URL ke worker ini (misal: example.com/api/*)</p>
              <div className="space-y-2">
                <Select value={selectedZoneId} onValueChange={(v) => { setSelectedZoneId(v); loadRoutes(v); }}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Pilih zone / domain..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id} className="text-white hover:bg-gray-700">{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedZoneId && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="example.com/api/*"
                      value={newRoutePattern}
                      onChange={(e) => setNewRoutePattern(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addRoute()}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1"
                    />
                    <Button onClick={addRoute} disabled={addingRoute || !newRoutePattern.trim()} className="bg-orange-500 hover:bg-orange-600 shrink-0">
                      {addingRoute ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {!selectedZoneId ? (
                  <div className="text-center py-6">
                    <p className="text-gray-500 text-sm">Pilih zone dulu untuk lihat routes</p>
                  </div>
                ) : routesLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : routes.length === 0 ? (
                  <div className="text-center py-8">
                    <Route className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Belum ada route untuk worker ini</p>
                  </div>
                ) : (
                  routes.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg gap-3">
                      <p className="text-sm text-white font-mono truncate">{r.pattern}</p>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                        onClick={() => setDeleteRoute({ route: r, zoneId: selectedZoneId })}>
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete domain confirm */}
      <AlertDialog open={!!deleteDomain} onOpenChange={(o) => !o && setDeleteDomain(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Custom Domain</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus domain <strong className="text-white">{deleteDomain?.hostname}</strong> dari worker <strong className="text-white">{domainWorker?.id ?? domainWorker?.script_name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDomain} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete route confirm */}
      <AlertDialog open={!!deleteRoute} onOpenChange={(o) => !o && setDeleteRoute(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Route</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus route <strong className="text-white font-mono">{deleteRoute?.route.pattern}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRoute} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete worker confirm */}
      <AlertDialog open={!!deleteWorker} onOpenChange={(o) => !o && setDeleteWorker(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Worker</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus worker <strong className="text-white">"{deleteWorker?.id ?? deleteWorker?.script_name}"</strong>? Worker yang sudah terhapus tidak bisa dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteWorkerConfirm} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
