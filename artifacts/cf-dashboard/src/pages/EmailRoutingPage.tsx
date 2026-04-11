import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ZoneSelector, { type Zone } from "@/components/ZoneSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MailIcon, PlusIcon, Trash2Icon, Loader2, CheckCircle2Icon, XCircleIcon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailRule {
  tag: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchers: { type: string; field: string; value: string }[];
  actions: { type: string; value: string[] }[];
}

interface EmailAddress {
  tag: string;
  email: string;
  verified: string;
  created: string;
  modified: string;
}

export default function EmailRoutingPage() {
  const { toast } = useToast();
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [addresses, setAddresses] = useState<EmailAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [addAddrOpen, setAddAddrOpen] = useState(false);
  const [deleteRule, setDeleteRule] = useState<EmailRule | null>(null);
  const [deleteAddr, setDeleteAddr] = useState<EmailAddress | null>(null);
  const [saving, setSaving] = useState(false);

  const [ruleForm, setRuleForm] = useState({
    name: "",
    matcherValue: "",
    actionValue: "",
    enabled: true,
  });
  const [addrForm, setAddrForm] = useState({ email: "" });

  const fetchData = async (id: string) => {
    setLoading(true);
    const [rulesRes, addrsRes] = await Promise.all([
      api.get(`/zones/${id}/email/routing/rules`),
      api.get(`/accounts/${id}/email/routing/addresses`),
    ]);
    if (rulesRes.ok) setRules((rulesRes.data as { result: EmailRule[] }).result ?? []);
    if (addrsRes.ok) setAddresses((addrsRes.data as { result: EmailAddress[] }).result ?? []);
    setLoading(false);
  };

  const fetchRules = async (id: string) => {
    const res = await api.get(`/zones/${id}/email/routing/rules`);
    if (res.ok) setRules((res.data as { result: EmailRule[] }).result ?? []);
  };

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    fetchRules(id);
  };

  const toggleRule = async (rule: EmailRule) => {
    const res = await api.put(`/zones/${zoneId}/email/routing/rules/${rule.tag}`, {
      ...rule,
      enabled: !rule.enabled,
    });
    if (res.ok) {
      toast({ title: rule.enabled ? "Rule dinonaktifkan" : "Rule diaktifkan" });
      fetchRules(zoneId);
    }
  };

  const addRule = async () => {
    setSaving(true);
    const res = await api.post(`/zones/${zoneId}/email/routing/rules`, {
      name: ruleForm.name,
      enabled: ruleForm.enabled,
      priority: rules.length + 1,
      matchers: [{ type: "literal", field: "to", value: ruleForm.matcherValue }],
      actions: [{ type: "forward", value: [ruleForm.actionValue] }],
    });
    if (res.ok) {
      toast({ title: "Email rule ditambahkan" });
      setAddRuleOpen(false);
      setRuleForm({ name: "", matcherValue: "", actionValue: "", enabled: true });
      fetchRules(zoneId);
    } else {
      const err = res.data as { errors?: { message: string }[] };
      toast({ title: err.errors?.[0]?.message ?? "Gagal menambah rule", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeleteRule = async () => {
    if (!deleteRule) return;
    const res = await api.delete(`/zones/${zoneId}/email/routing/rules/${deleteRule.tag}`);
    if (res.ok) {
      toast({ title: "Rule dihapus" });
      setRules((p) => p.filter((r) => r.tag !== deleteRule.tag));
    }
    setDeleteRule(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Routing</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName || "Pilih domain untuk mengelola email routing"}</p>
        </div>
        <ZoneSelector value={zoneId} onChange={handleZoneChange} />
      </div>

      {!zoneId ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-12 text-center">
            <MailIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Pilih domain untuk melihat konfigurasi Email Routing</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger value="rules" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="addresses" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              Destination Addresses ({addresses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAddRuleOpen(true)} className="bg-orange-500 hover:bg-orange-600 gap-1.5">
                <PlusIcon className="w-4 h-4" /> Tambah Rule
              </Button>
            </div>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-gray-800" />)}</div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-10">
                    <MailIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Belum ada email routing rule</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {rules.map((rule) => (
                      <div key={rule.tag} className="flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors group">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", rule.enabled ? "bg-green-400" : "bg-gray-600")} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{rule.name || "Unnamed Rule"}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {rule.matchers?.map((m, i) => (
                                <span key={i} className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-0.5 rounded">
                                  {m.field}: {m.value}
                                </span>
                              ))}
                              <span className="text-xs text-gray-500">→</span>
                              {rule.actions?.flatMap((a) => a.value).map((v, i) => (
                                <span key={i} className="text-xs text-orange-400 font-mono bg-orange-500/10 px-2 py-0.5 rounded">{v}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={cn("text-xs", rule.enabled ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400")}>
                            {rule.enabled ? "Aktif" : "Nonaktif"}
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100" onClick={() => setDeleteRule(rule)}>
                            <Trash2Icon className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAddAddrOpen(true)} className="bg-orange-500 hover:bg-orange-600 gap-1.5">
                <PlusIcon className="w-4 h-4" /> Tambah Alamat
              </Button>
            </div>
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="p-0">
                {addresses.length === 0 ? (
                  <div className="text-center py-10">
                    <MailIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Belum ada destination address</p>
                    <p className="text-xs text-gray-600 mt-1">Tambah alamat email tujuan forwarding</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {addresses.map((addr) => (
                      <div key={addr.tag} className="flex items-center justify-between p-4 hover:bg-gray-800/30 group">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", addr.verified ? "bg-green-500/10" : "bg-yellow-500/10")}>
                            {addr.verified ? <CheckCircle2Icon className="w-4 h-4 text-green-400" /> : <InfoIcon className="w-4 h-4 text-yellow-400" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{addr.email}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{addr.verified ? "Terverifikasi" : "Belum diverifikasi — cek email"}</p>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100" onClick={() => setDeleteAddr(addr)}>
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Add rule dialog */}
      <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
          <DialogHeader><DialogTitle>Tambah Email Routing Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Nama Rule</Label>
              <Input value={ruleForm.name} onChange={(e) => setRuleForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: Forward support" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Email Penerima (match)</Label>
              <Input value={ruleForm.matcherValue} onChange={(e) => setRuleForm(p => ({ ...p, matcherValue: e.target.value }))} placeholder="support@domain.com" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-xs">Forward ke Alamat</Label>
              <Input value={ruleForm.actionValue} onChange={(e) => setRuleForm(p => ({ ...p, actionValue: e.target.value }))} placeholder="kamu@gmail.com" className="bg-gray-800 border-gray-700 text-white" />
            </div>
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="ghost" onClick={() => setAddRuleOpen(false)} className="text-gray-400">Batal</Button>
            <Button onClick={addRule} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete rule confirm */}
      <AlertDialog open={!!deleteRule} onOpenChange={(o) => !o && setDeleteRule(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Email Rule</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus rule <strong className="text-white">"{deleteRule?.name}"</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
