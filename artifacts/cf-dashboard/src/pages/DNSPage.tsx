import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { api } from "@/lib/api";
import ZoneSelector, { type Zone } from "@/components/ZoneSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { DatabaseIcon, PlusIcon, PencilIcon, Trash2Icon, SearchIcon, RefreshCwIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  modified_on: string;
  created_on: string;
}

const DNS_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA", "PTR", "HTTPS", "TLSA"];

const TTL_OPTIONS = [
  { value: 1, label: "Auto" },
  { value: 60, label: "1 menit" },
  { value: 120, label: "2 menit" },
  { value: 300, label: "5 menit" },
  { value: 600, label: "10 menit" },
  { value: 900, label: "15 menit" },
  { value: 1800, label: "30 menit" },
  { value: 3600, label: "1 jam" },
  { value: 7200, label: "2 jam" },
  { value: 18000, label: "5 jam" },
  { value: 43200, label: "12 jam" },
  { value: 86400, label: "1 hari" },
];

const TYPE_COLORS: Record<string, string> = {
  A: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  AAAA: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  CNAME: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  MX: "bg-green-500/20 text-green-400 border-green-500/30",
  TXT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  NS: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  default: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function RecordForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: Partial<DNSRecord>;
  onSave: (data: Partial<DNSRecord>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    type: initial?.type ?? "A",
    name: initial?.name ?? "",
    content: initial?.content ?? "",
    ttl: initial?.ttl ?? 1,
    proxied: initial?.proxied ?? false,
    priority: initial?.priority ?? 10,
  });

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const canProxy = ["A", "AAAA", "CNAME"].includes(form.type);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-gray-300 text-xs">Tipe Record</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {DNS_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-white hover:bg-gray-700">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-gray-300 text-xs">TTL</Label>
          <Select value={String(form.ttl)} onValueChange={(v) => set("ttl", Number(v))}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {TTL_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={String(t.value)} className="text-white hover:bg-gray-700">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-gray-300 text-xs">Name</Label>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="@ atau subdomain"
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-gray-300 text-xs">Content / Value</Label>
        <Input
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder={form.type === "A" ? "1.2.3.4" : form.type === "CNAME" ? "target.example.com" : ""}
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
        />
      </div>
      {form.type === "MX" && (
        <div className="space-y-1.5">
          <Label className="text-gray-300 text-xs">Priority</Label>
          <Input
            type="number"
            value={form.priority}
            onChange={(e) => set("priority", Number(e.target.value))}
            className="bg-gray-800 border-gray-700 text-white"
          />
        </div>
      )}
      {canProxy && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
          <div>
            <p className="text-sm text-white">Proxied (Cloudflare)</p>
            <p className="text-xs text-gray-400 mt-0.5">Traffic melewati Cloudflare untuk proteksi</p>
          </div>
          <Switch checked={form.proxied} onCheckedChange={(v) => set("proxied", v)} />
        </div>
      )}
      <DialogFooter className="gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} className="text-gray-400 hover:text-white">Batal</Button>
        <Button onClick={() => onSave(form)} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Simpan
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function DNSPage() {
  const { toast } = useToast();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const initialZoneId = params.get("zone") ?? "";
  const initialZoneName = params.get("name") ?? "";

  const [zoneId, setZoneId] = useState(initialZoneId);
  const [zoneName, setZoneName] = useState(initialZoneName);
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editRecord, setEditRecord] = useState<DNSRecord | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<DNSRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRecords = async (id: string) => {
    if (!id) return;
    setLoading(true);
    const res = await api.get(`/zones/${id}/dns_records?per_page=100`);
    if (res.ok) setRecords((res.data as { result: DNSRecord[] }).result ?? []);
    setLoading(false);
  };

  useEffect(() => { if (zoneId) fetchRecords(zoneId); }, [zoneId]);

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    fetchRecords(id);
  };

  const filtered = records.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (data: Partial<DNSRecord>) => {
    setSaving(true);
    const res = await api.post(`/zones/${zoneId}/dns_records`, data);
    if (res.ok) {
      toast({ title: "Record berhasil ditambahkan" });
      setAddOpen(false);
      fetchRecords(zoneId);
    } else {
      const err = res.data as { errors?: { message: string }[] };
      toast({ title: err.errors?.[0]?.message ?? "Gagal menambah record", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = async (data: Partial<DNSRecord>) => {
    if (!editRecord) return;
    setSaving(true);
    const res = await api.put(`/zones/${zoneId}/dns_records/${editRecord.id}`, data);
    if (res.ok) {
      toast({ title: "Record berhasil diperbarui" });
      setEditRecord(null);
      fetchRecords(zoneId);
    } else {
      toast({ title: "Gagal memperbarui record", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteRecord) return;
    const res = await api.delete(`/zones/${zoneId}/dns_records/${deleteRecord.id}`);
    if (res.ok) {
      toast({ title: "Record dihapus" });
      setRecords((p) => p.filter((r) => r.id !== deleteRecord.id));
    } else {
      toast({ title: "Gagal menghapus record", variant: "destructive" });
    }
    setDeleteRecord(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">DNS Records</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName ? `${zoneName} — ${records.length} records` : "Pilih domain untuk melihat DNS records"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ZoneSelector value={zoneId} onChange={handleZoneChange} />
          {zoneId && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="bg-orange-500 hover:bg-orange-600 gap-1.5 text-sm">
              <PlusIcon className="w-4 h-4" /> Tambah
            </Button>
          )}
        </div>
      </div>

      {zoneId && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Cari record..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>
      )}

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          {!zoneId ? (
            <div className="text-center py-12">
              <DatabaseIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Pilih domain di atas untuk melihat DNS records</p>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full bg-gray-800" />)}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 font-medium">
                <div className="col-span-2">Type</div>
                <div className="col-span-3">Name</div>
                <div className="col-span-4">Content</div>
                <div className="col-span-1 text-center">Proxy</div>
                <div className="col-span-1 text-right">TTL</div>
                <div className="col-span-1"></div>
              </div>
              <div className="divide-y divide-gray-800/50">
                {filtered.map((record) => (
                  <div key={record.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-800/30 transition-colors items-center group">
                    <div className="col-span-2">
                      <Badge className={cn("text-xs font-mono", TYPE_COLORS[record.type] ?? TYPE_COLORS.default)}>
                        {record.type}
                      </Badge>
                    </div>
                    <div className="col-span-3 text-sm text-white truncate font-mono" title={record.name}>{record.name}</div>
                    <div className="col-span-4 text-sm text-gray-300 truncate font-mono" title={record.content}>{record.content}</div>
                    <div className="col-span-1 text-center">
                      {record.proxied ? (
                        <span className="text-orange-400 text-xs">ON</span>
                      ) : (
                        <span className="text-gray-600 text-xs">OFF</span>
                      )}
                    </div>
                    <div className="col-span-1 text-right text-xs text-gray-500">
                      {record.ttl === 1 ? "Auto" : record.ttl}
                    </div>
                    <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setEditRecord(record)}>
                        <PencilIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => setDeleteRecord(record)}>
                        <Trash2Icon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-gray-500 text-sm">Tidak ada record ditemukan</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add record dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah DNS Record</DialogTitle>
          </DialogHeader>
          <RecordForm onSave={handleAdd} onCancel={() => setAddOpen(false)} loading={saving} />
        </DialogContent>
      </Dialog>

      {/* Edit record dialog */}
      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit DNS Record</DialogTitle>
          </DialogHeader>
          {editRecord && <RecordForm initial={editRecord} onSave={handleEdit} onCancel={() => setEditRecord(null)} loading={saving} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRecord} onOpenChange={(o) => !o && setDeleteRecord(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus DNS Record</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus record <strong className="text-white font-mono">{deleteRecord?.type} {deleteRecord?.name}</strong>? Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
