import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  GlobeIcon, SearchIcon, RefreshCwIcon, Trash2Icon, PauseIcon, PlayIcon,
  CheckCircleIcon, AlertCircleIcon, PauseCircleIcon, PlusCircleIcon, Loader2, InfoIcon
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  plan: { name: string };
  owner: { name: string; email: string };
  created_on: string;
  modified_on: string;
  name_servers: string[];
  original_name_servers: string[];
}

function ZoneStatusBadge({ status, paused }: { status: string; paused: boolean }) {
  if (paused) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[11px] sm:text-xs shrink-0"><PauseCircleIcon className="w-3 h-3 mr-1" />Paused</Badge>;
  if (status === "active") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[11px] sm:text-xs shrink-0"><CheckCircleIcon className="w-3 h-3 mr-1" />Active</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[11px] sm:text-xs shrink-0"><AlertCircleIcon className="w-3 h-3 mr-1" />{status}</Badge>;
}

export default function ZonesPage() {
  const { toast } = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteZone, setDeleteZone] = useState<Zone | null>(null);
  const [detailZone, setDetailZone] = useState<Zone | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newZoneName, setNewZoneName] = useState("");

  const fetchZones = async () => {
    setLoading(true);
    const res = await api.get("/zones?per_page=50");
    if (res.ok) setZones((res.data as { result: Zone[] }).result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchZones(); }, []);

  const filtered = zones.filter((z) =>
    z.name.toLowerCase().includes(search.toLowerCase())
  );

  const togglePause = async (zone: Zone) => {
    setActionLoading(zone.id);
    const res = await api.patch(`/zones/${zone.id}/settings/paused`, { value: !zone.paused });
    if (res.ok) {
      setZones((prev) => prev.map((z) => z.id === zone.id ? { ...z, paused: !zone.paused } : z));
      toast({ title: zone.paused ? "Zone diaktifkan" : "Zone dijeda" });
    } else {
      toast({ title: "Gagal mengubah status zone", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const deleteZoneConfirm = async () => {
    if (!deleteZone) return;
    setActionLoading(deleteZone.id);
    const res = await api.delete(`/zones/${deleteZone.id}`);
    if (res.ok) {
      setZones((prev) => prev.filter((z) => z.id !== deleteZone.id));
      toast({ title: `Domain ${deleteZone.name} dihapus` });
    } else {
      toast({ title: "Gagal menghapus zone", variant: "destructive" });
    }
    setDeleteZone(null);
    setActionLoading(null);
  };

  const createZone = async () => {
    if (!newZoneName.trim()) return;
    setCreating(true);
    const res = await api.post("/zones", { name: newZoneName.trim() });
    if (res.ok) {
      toast({ title: `Domain ${newZoneName} ditambahkan` });
      setCreateOpen(false);
      setNewZoneName("");
      fetchZones();
    } else {
      toast({ title: "Gagal menambahkan domain", variant: "destructive" });
    }
    setCreating(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Domains / Zones</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5 truncate">{zones.length} domain terdaftar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-orange-500 hover:bg-orange-600 gap-2 h-8 px-2 sm:px-3">
            <PlusCircleIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Domain</span>
          </Button>
          <Button size="sm" variant="outline" onClick={fetchZones} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 shrink-0 h-8 px-2 sm:px-3">
            <RefreshCwIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Cari domain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
        />
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[72px] w-full bg-gray-800 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <GlobeIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Tidak ada domain ditemukan</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filtered.map((zone) => (
                <div key={zone.id} className="p-3 sm:p-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className={cn(
                      "w-8 h-8 sm:w-9 sm:h-9 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
                      zone.status === "active" && !zone.paused ? "bg-green-500/10" : "bg-gray-800"
                    )}>
                      <GlobeIcon className={cn("w-4 h-4", zone.status === "active" && !zone.paused ? "text-green-400" : "text-gray-500")} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-none">{zone.name}</p>
                        <ZoneStatusBadge status={zone.status} paused={zone.paused} />
                      </div>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">{zone.plan?.name ?? "Free"} · {formatDate(zone.created_on)}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-white"
                        onClick={() => setDetailZone(zone)}
                        title="Detail"
                      >
                        <InfoIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-8 w-8",
                          zone.paused
                            ? "text-green-400 hover:bg-green-500/10"
                            : "text-yellow-400 hover:bg-yellow-500/10"
                        )}
                        onClick={() => togglePause(zone)}
                        disabled={actionLoading === zone.id}
                        title={zone.paused ? "Aktifkan" : "Pause"}
                      >
                        {actionLoading === zone.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : zone.paused
                            ? <PlayIcon className="w-3.5 h-3.5" />
                            : <PauseIcon className="w-3.5 h-3.5" />
                        }
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setDeleteZone(zone)}
                        title="Hapus"
                      >
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircleIcon className="w-4 h-4 text-orange-400" />
              Tambah Domain
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">Nama domain</p>
              <Input
                placeholder="contoh.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">Catatan</p>
              <p className="text-xs text-gray-500">Fitur ini menambah domain ke akun Cloudflare kamu, bukan hanya ke project tertentu.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-gray-400">Batal</Button>
              <Button onClick={createZone} disabled={creating || !newDomain.trim()} className="bg-orange-500 hover:bg-orange-600">
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Tambah
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailZone} onOpenChange={(o) => !o && setDetailZone(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GlobeIcon className="w-5 h-5 text-orange-400" />
              {detailZone?.name}
            </DialogTitle>
          </DialogHeader>
          {detailZone && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {[
                  { label: "Status", value: <ZoneStatusBadge status={detailZone.status} paused={detailZone.paused} /> },
                  { label: "Plan", value: detailZone.plan?.name ?? "Free" },
                  { label: "Dibuat", value: formatDate(detailZone.created_on) },
                  { label: "Diperbarui", value: formatDate(detailZone.modified_on) },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-800/50 p-3 rounded-lg min-w-0">
                    <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                    <div className="text-sm text-white break-words">{item.value}</div>
                  </div>
                ))}
              </div>
              {detailZone.name_servers?.length > 0 && (
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-400 mb-2">Cloudflare Nameservers</p>
                  <div className="space-y-1">
                    {detailZone.name_servers.map((ns) => (
                      <p key={ns} className="text-sm text-orange-400 font-mono break-all">{ns}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-gray-800/30 px-3 py-2 rounded-lg">
                <p className="text-xs text-gray-500 font-mono break-all">ID: {detailZone.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteZone} onOpenChange={(o) => !o && setDeleteZone(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Domain</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Yakin mau hapus <strong className="text-white">{deleteZone?.name}</strong>? Tindakan ini tidak bisa dibatalkan dan akan menghapus semua DNS records dan konfigurasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteZoneConfirm} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
