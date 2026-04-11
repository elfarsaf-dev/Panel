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
import { ZapIcon, PlusIcon, Trash2Icon, PauseIcon, PlayIcon, Loader2, PencilIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageRule {
  id: string;
  status: "active" | "disabled";
  priority: number;
  targets: { target: string; constraint: { operator: string; value: string } }[];
  actions: { id: string; value: unknown }[];
  created_on: string;
  modified_on: string;
}

const PAGE_RULE_ACTIONS = [
  { id: "always_use_https", label: "Always Use HTTPS", valueType: "none" },
  { id: "cache_level", label: "Cache Level", valueType: "select", options: ["bypass", "basic", "simplified", "aggressive", "cache_everything"] },
  { id: "edge_cache_ttl", label: "Edge Cache TTL (s)", valueType: "number" },
  { id: "browser_cache_ttl", label: "Browser Cache TTL (s)", valueType: "number" },
  { id: "forwarding_url", label: "Forwarding URL", valueType: "redirect" },
  { id: "disable_apps", label: "Disable Apps", valueType: "none" },
  { id: "disable_performance", label: "Disable Performance", valueType: "none" },
  { id: "disable_security", label: "Disable Security", valueType: "none" },
  { id: "rocket_loader", label: "Rocket Loader", valueType: "onoff" },
  { id: "minify", label: "Minify", valueType: "minify" },
];

export default function PageRulesPage() {
  const { toast } = useToast();
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [rules, setRules] = useState<PageRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteRule, setDeleteRule] = useState<PageRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: "",
    actionId: "always_use_https",
    actionValue: "" as string | number,
    redirectCode: "301",
    redirectUrl: "",
  });

  const fetchRules = async (id: string) => {
    setLoading(true);
    const res = await api.get(`/zones/${id}/pagerules?status=all&order=priority&direction=asc`);
    if (res.ok) setRules((res.data as { result: PageRule[] }).result ?? []);
    setLoading(false);
  };

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    fetchRules(id);
  };

  const toggle = async (rule: PageRule) => {
    setActionLoading(rule.id);
    const newStatus = rule.status === "active" ? "disabled" : "active";
    const res = await api.patch(`/zones/${zoneId}/pagerules/${rule.id}`, { status: newStatus });
    if (res.ok) {
      toast({ title: newStatus === "active" ? "Page rule diaktifkan" : "Page rule dijeda" });
      fetchRules(zoneId);
    }
    setActionLoading(null);
  };

  const addRule = async () => {
    setSaving(true);
    const selectedAction = PAGE_RULE_ACTIONS.find((a) => a.id === form.actionId);
    let actionValue: unknown = undefined;
    if (selectedAction?.valueType === "none") actionValue = "on";
    else if (selectedAction?.valueType === "onoff") actionValue = "on";
    else if (selectedAction?.valueType === "number") actionValue = Number(form.actionValue);
    else if (selectedAction?.valueType === "redirect") {
      actionValue = { status_code: Number(form.redirectCode), url: form.redirectUrl };
    } else actionValue = form.actionValue;

    const res = await api.post(`/zones/${zoneId}/pagerules`, {
      targets: [{ target: "url", constraint: { operator: "matches", value: form.url } }],
      actions: [{ id: form.actionId, value: actionValue }],
      status: "active",
      priority: rules.length + 1,
    });
    if (res.ok) {
      toast({ title: "Page rule ditambahkan" });
      setAddOpen(false);
      setForm({ url: "", actionId: "always_use_https", actionValue: "", redirectCode: "301", redirectUrl: "" });
      fetchRules(zoneId);
    } else {
      const err = res.data as { errors?: { message: string }[] };
      toast({ title: err.errors?.[0]?.message ?? "Gagal menambah page rule", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteRule) return;
    const res = await api.delete(`/zones/${zoneId}/pagerules/${deleteRule.id}`);
    if (res.ok) {
      toast({ title: "Page rule dihapus" });
      setRules((p) => p.filter((r) => r.id !== deleteRule.id));
    }
    setDeleteRule(null);
  };

  const selectedAction = PAGE_RULE_ACTIONS.find((a) => a.id === form.actionId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Page Rules</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName || "Pilih domain untuk mengelola page rules"}</p>
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
              <ZapIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Pilih domain untuk melihat page rules</p>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-gray-800" />)}</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <ZapIcon className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Belum ada page rule</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {rules.map((rule, idx) => (
                <div key={rule.id} className="flex items-start justify-between p-4 hover:bg-gray-800/30 transition-colors group">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="text-xs text-gray-600 w-6 text-center mt-1 shrink-0">{idx + 1}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-orange-300 truncate">
                        {rule.targets?.[0]?.constraint?.value ?? "?"}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {rule.actions?.map((action, i) => (
                          <Badge key={i} className="bg-gray-700/80 text-gray-300 border-gray-600 text-xs font-mono">
                            {action.id}
                          </Badge>
                        ))}
                        <Badge className={cn("text-xs", rule.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400")}>
                          {rule.status === "active" ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon" variant="ghost"
                      className={cn("h-8 w-8", rule.status === "disabled" ? "text-green-400" : "text-yellow-400")}
                      onClick={() => toggle(rule)}
                      disabled={actionLoading === rule.id}
                    >
                      {actionLoading === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : rule.status === "active" ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5" />}
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

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg">
          <DialogHeader><DialogTitle>Tambah Page Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">URL Pattern</Label>
              <Input value={form.url} onChange={(e) => setForm(p => ({ ...p, url: e.target.value }))} placeholder="*example.com/path/*" className="bg-gray-800 border-gray-700 text-white font-mono" />
              <p className="text-xs text-gray-600">Gunakan * sebagai wildcard</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Action</Label>
              <Select value={form.actionId} onValueChange={(v) => setForm(p => ({ ...p, actionId: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {PAGE_RULE_ACTIONS.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-white hover:bg-gray-700">{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAction?.valueType === "select" && (
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">Value</Label>
                <Select value={String(form.actionValue)} onValueChange={(v) => setForm(p => ({ ...p, actionValue: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {selectedAction.options?.map((o) => (
                      <SelectItem key={o} value={o} className="text-white hover:bg-gray-700">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedAction?.valueType === "number" && (
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">Value (detik)</Label>
                <Input type="number" value={String(form.actionValue)} onChange={(e) => setForm(p => ({ ...p, actionValue: e.target.value }))} className="bg-gray-800 border-gray-700 text-white" />
              </div>
            )}
            {selectedAction?.valueType === "redirect" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Status Code</Label>
                  <Select value={form.redirectCode} onValueChange={(v) => setForm(p => ({ ...p, redirectCode: v }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="301" className="text-white hover:bg-gray-700">301 - Permanent</SelectItem>
                      <SelectItem value="302" className="text-white hover:bg-gray-700">302 - Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-xs">Redirect URL</Label>
                  <Input value={form.redirectUrl} onChange={(e) => setForm(p => ({ ...p, redirectUrl: e.target.value }))} placeholder="https://target.com/$1" className="bg-gray-800 border-gray-700 text-white font-mono" />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-gray-400">Batal</Button>
            <Button onClick={addRule} disabled={saving || !form.url} className="bg-orange-500 hover:bg-orange-600">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRule} onOpenChange={(o) => !o && setDeleteRule(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Page Rule</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus rule untuk <strong className="text-white font-mono">"{deleteRule?.targets?.[0]?.constraint?.value}"</strong>?
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
