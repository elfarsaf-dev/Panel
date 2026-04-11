import { useEffect, useState } from "react";
import { api, getCredentials } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CodeIcon, PlusIcon, Trash2Icon, RefreshCwIcon, EyeIcon, Loader2, ClockIcon, PencilIcon } from "lucide-react";
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

type DialogMode = "add" | "edit" | "view";

export default function WorkersPage() {
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  const [formName, setFormName] = useState("");
  const [formScript, setFormScript] = useState(DEFAULT_SCRIPT);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteWorker, setDeleteWorker] = useState<Worker | null>(null);

  const fetchWorkers = async (accId?: string) => {
    setLoading(true);
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
    const res = await api.get(`/accounts/${accountId}/workers/scripts/${name}`);
    if (res.ok) {
      setFormScript(typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2));
    } else {
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
    const res = await api.get(`/accounts/${accountId}/workers/scripts/${name}`);
    if (res.ok) {
      setFormScript(typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2));
    } else {
      setFormScript("// Tidak dapat memuat script");
    }
    setFormLoading(false);
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
