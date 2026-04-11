import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ZoneSelector, { type Zone } from "@/components/ZoneSelector";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldIcon, PlusIcon, Trash2Icon, PauseIcon, PlayIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FirewallRule {
  id: string;
  paused: boolean;
  description: string;
  priority?: number;
  action: string;
  filter: { id: string; expression: string; paused: boolean };
}

const ACTIONS = ["block", "challenge", "js_challenge", "managed_challenge", "allow", "log", "bypass"];
const ACTION_COLORS: Record<string, string> = {
  block: "bg-red-500/20 text-red-400 border-red-500/30",
  challenge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  js_challenge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  managed_challenge: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  allow: "bg-green-500/20 text-green-400 border-green-500/30",
  log: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  bypass: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function FirewallPage() {
  const { toast } = useToast();
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteRule, setDeleteRule] = useState<FirewallRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState({ description: "", expression: "", action: "block" });

  const fetchRules = async (id: string) => {
    setLoading(true);
    const res = await api.get(`/zones/${id}/firewall/rules?per_page=100`);
    if (res.ok) setRules((res.data as { result: FirewallRule[] }).result ?? []);
    setLoading(false);
  };

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    fetchRules(id);
  };

  const togglePause = async (rule: FirewallRule) => {
    setActionLoading(rule.id);
    const res = await api.patch(`/zones/${zoneId}/firewall/rules`, [{
      id: rule.id,
      paused: !rule.paused,
    }]);
    if (res.ok) {
      toast({ title: rule.paused ? "Rule diaktifkan" : "Rule dijeda" });
      fetchRules(zoneId);
    }
    setActionLoading(null);
  };

  const addRule = async () => {
    setSaving(true);
    // First create a filter
    const filterRes = await api.post(`/zones/${zoneId}/filters`, [{
      expression: form.expression,
    }]);
    
    let filterId = "";
    if (filterRes.ok) {
      const filters = (filterRes.data as { result: { id: string }[] }).result;
      filterId = filters?.[0]?.id;
    }
    
    if (!filterId) {
      toast({ title: "Gagal membuat filter", variant: "destructive" });
      setSaving(false);
      return;
    }

    const res = await api.post(`/zones/${zoneId}/firewall/rules`, [{
      filter: { id: filterId },
      action: form.action,
      description: form.description,
    }]);
    
    if (res.ok) {
      toast({ title: "Firewall rule ditambahkan" });
      setAddOpen(false);
      setForm({ description: "", expression: "", action: "block" });
      fetchRules(zoneId);
    } else {
      const err = res.data as { errors?: { message: string }[] };
      toast({ title: err.errors?.[0]?.message ?? "Gagal menambah rule", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteRule) return;
    const res = await api.delete(`/zones/${zoneId}/firewall/rules?id=${deleteRule.id}`);
    if (res.ok) {
      toast({ title: "Firewall rule dihapus" });
      setRules((p) => p.filter((r) => r.id !== deleteRule.id));
    } else {
      toast({ title: "Gagal menghapus rule", variant: "destructive" });
    }
    setDeleteRule(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Firewall / WAF</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName || "Pilih domain untuk mengelola firewall"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ZoneSelector value={zoneId} onChange={handleZoneChange} />
          {zoneId && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="bg-orange-500 hover:bg-orange-600 gap-1.5">
              <PlusIcon className="w-4 h-4" /> Tambah Rule
            </Button>
          )}
        </div>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          {!zoneId ? (
            <div className="text-center py-12">
              <ShieldIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Pilih domain untuk melihat firewall rules</p>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-gray-800" />)}</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <ShieldIcon className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Belum ada firewall rule</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-start justify-between p-4 hover:bg-gray-800/30 transition-colors group">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", rule.paused ? "bg-gray-600" : "bg-green-400")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white">{rule.description || "Tanpa nama"}</p>
                        <Badge className={cn("text-xs", ACTION_COLORS[rule.action] ?? "bg-gray-500/20 text-gray-400")}>
                          {rule.action}
                        </Badge>
                        {rule.paused && <Badge className="bg-gray-500/20 text-gray-400 text-xs">Paused</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-mono truncate">{rule.filter?.expression}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon" variant="ghost"
                      className={cn("h-8 w-8", rule.paused ? "text-green-400 hover:bg-green-500/10" : "text-yellow-400 hover:bg-yellow-500/10")}
                      onClick={() => togglePause(rule)}
                      disabled={actionLoading === rule.id}
                    >
                      {actionLoading === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : rule.paused ? <PlayIcon className="w-3.5 h-3.5" /> : <PauseIcon className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => setDeleteRule(rule)}>
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add rule dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader><DialogTitle>Tambah Firewall Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Deskripsi (opsional)</Label>
              <Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Blokir IP tertentu" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Filter Expression</Label>
              <textarea
                value={form.expression}
                onChange={(e) => setForm(p => ({ ...p, expression: e.target.value }))}
                rows={3}
                placeholder='(ip.src eq "1.2.3.4") or (cf.threat_score gt 50)'
                className="w-full rounded-lg bg-gray-950 border border-gray-700 text-orange-300 font-mono text-xs p-3 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
              />
              <p className="text-xs text-gray-600">Gunakan Cloudflare filter expression syntax</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Action</Label>
              <Select value={form.action} onValueChange={(v) => setForm(p => ({ ...p, action: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a} className="text-white hover:bg-gray-700 capitalize">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-gray-400">Batal</Button>
            <Button onClick={addRule} disabled={saving || !form.expression} className="bg-orange-500 hover:bg-orange-600">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRule} onOpenChange={(o) => !o && setDeleteRule(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Firewall Rule</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus rule <strong className="text-white">"{deleteRule?.description || "ini"}"</strong>?
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
