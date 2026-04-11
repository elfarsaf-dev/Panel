import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CodeIcon, PlusIcon, Trash2Icon, RefreshCwIcon, EyeIcon, Loader2, ClockIcon, ExternalLinkIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Worker {
  id: string;
  script_name?: string;
  created_on: string;
  modified_on: string;
  usage_model?: string;
  etag?: string;
}

const DEFAULT_SCRIPT = `export default {
  async fetch(request, env, ctx) {
    return new Response('Hello from Cloudflare Worker!', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
};
`;

export default function WorkersPage() {
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [deleteWorker, setDeleteWorker] = useState<Worker | null>(null);
  const [viewWorker, setViewWorker] = useState<Worker | null>(null);
  const [workerScript, setWorkerScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployForm, setDeployForm] = useState({ name: "", script: DEFAULT_SCRIPT });
  const [deploying, setDeploying] = useState(false);

  const fetchWorkers = async (accId?: string) => {
    setLoading(true);
    // First get account id from zones
    let aid = accId ?? accountId;
    if (!aid) {
      const zonesRes = await api.get("/zones?per_page=1");
      if (zonesRes.ok) {
        const zones = (zonesRes.data as { result: { account: { id: string } }[] }).result;
        if (zones[0]?.account?.id) {
          aid = zones[0].account.id;
          setAccountId(aid);
        }
      }
    }
    if (!aid) { setLoading(false); return; }
    const res = await api.get(`/accounts/${aid}/workers/scripts`);
    if (res.ok) setWorkers((res.data as { result: Worker[] }).result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchWorkers(); }, []);

  const viewScript = async (worker: Worker) => {
    setViewWorker(worker);
    setScriptLoading(true);
    const name = worker.id ?? worker.script_name;
    const res = await api.get(`/accounts/${accountId}/workers/scripts/${name}`);
    if (res.ok) {
      setWorkerScript(typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2));
    } else {
      setWorkerScript("// Tidak dapat memuat script");
    }
    setScriptLoading(false);
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

  const deployWorker = async () => {
    setDeploying(true);
    const formData = new FormData();
    const blob = new Blob([deployForm.script], { type: "application/javascript" });
    formData.append("script", blob, "worker.js");
    
    try {
      const res = await fetch(`https://panelv1.elfar.my.id/accounts/${accountId}/workers/scripts/${deployForm.name}`, {
        method: "PUT",
        headers: {
          Authorization: "Basic " + btoa(localStorage.getItem("cf_creds") ? JSON.parse(localStorage.getItem("cf_creds")!).username + ":" + JSON.parse(localStorage.getItem("cf_creds")!).password : ""),
        },
        body: formData,
      });
      if (res.ok) {
        toast({ title: `Worker "${deployForm.name}" berhasil di-deploy` });
        setDeployOpen(false);
        setDeployForm({ name: "", script: DEFAULT_SCRIPT });
        fetchWorkers(accountId);
      } else {
        toast({ title: "Gagal deploy worker", variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menghubungi API", variant: "destructive" });
    }
    setDeploying(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Workers & Scripts</h1>
          <p className="text-gray-400 text-sm mt-1">{workers.length} worker aktif</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => fetchWorkers()} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <RefreshCwIcon className="w-4 h-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setDeployOpen(true)} className="bg-orange-500 hover:bg-orange-600 gap-1.5">
            <PlusIcon className="w-4 h-4" /> Deploy Worker
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
              <p className="text-xs text-gray-600 mt-1">Klik "Deploy Worker" untuk membuat script baru</p>
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
                        <div className="flex items-center gap-3 mt-0.5">
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => viewScript(worker)} title="Lihat script">
                        <EyeIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteWorker(worker)}>
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

      {/* View script dialog */}
      <Dialog open={!!viewWorker} onOpenChange={(o) => !o && setViewWorker(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CodeIcon className="w-4 h-4 text-purple-400" />
              {viewWorker?.id ?? viewWorker?.script_name}
            </DialogTitle>
          </DialogHeader>
          {scriptLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <pre className="text-xs text-green-400 bg-gray-950 rounded-lg p-4 overflow-auto font-mono leading-relaxed whitespace-pre-wrap">
              {workerScript}
            </pre>
          )}
        </DialogContent>
      </Dialog>

      {/* Deploy dialog */}
      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Deploy Worker Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Nama Worker</Label>
              <Input
                value={deployForm.name}
                onChange={(e) => setDeployForm(p => ({ ...p, name: e.target.value }))}
                placeholder="my-worker"
                className="bg-gray-800 border-gray-700 text-white font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Script (JavaScript)</Label>
              <textarea
                value={deployForm.script}
                onChange={(e) => setDeployForm(p => ({ ...p, script: e.target.value }))}
                rows={12}
                className="w-full rounded-lg bg-gray-950 border border-gray-700 text-green-400 font-mono text-xs p-3 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeployOpen(false)} className="text-gray-400">Batal</Button>
            <Button onClick={deployWorker} disabled={deploying || !deployForm.name} className="bg-orange-500 hover:bg-orange-600">
              {deploying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
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
