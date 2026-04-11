import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ZoneSelector, { type Zone } from "@/components/ZoneSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SettingsIcon, Loader2, RefreshCwIcon } from "lucide-react";

interface Setting {
  id: string;
  value: string | boolean | number;
  editable: boolean;
  modified_on: string;
}

const KNOWN_SETTINGS = [
  { id: "always_online", label: "Always Online", desc: "Sajikan halaman cache saat origin down", type: "onoff" },
  { id: "browser_check", label: "Browser Integrity Check", desc: "Blokir browser dengan reputasi buruk", type: "onoff" },
  { id: "challenge_ttl", label: "Challenge TTL", desc: "Durasi challenge cookie (detik)", type: "number" },
  { id: "development_mode", label: "Development Mode", desc: "Bypass cache selama 3 jam untuk development", type: "onoff" },
  { id: "email_obfuscation", label: "Email Obfuscation", desc: "Sembunyikan alamat email dari scraper", type: "onoff" },
  { id: "hotlink_protection", label: "Hotlink Protection", desc: "Cegah situs lain menggunakan resource kamu", type: "onoff" },
  { id: "ip_geolocation", label: "IP Geolocation", desc: "Tambah header CF-IPCountry ke setiap request", type: "onoff" },
  { id: "minify", label: "Minify (JS/CSS/HTML)", desc: "Kompres resource statis otomatis", type: "minify" },
  { id: "mirage", label: "Mirage Image Optimization", desc: "Optimasi gambar otomatis (Pro+)", type: "onoff" },
  { id: "opportunistic_encryption", label: "Opportunistic Encryption", desc: "Enable HTTP/2 untuk koneksi lebih cepat", type: "onoff" },
  { id: "prefetch_preload", label: "Prefetch/Preload", desc: "Prefetch halaman yang di-link", type: "onoff" },
  { id: "pseudo_ipv4", label: "Pseudo IPv4", desc: "Tambah header pseudo IPv4 untuk IPv6", type: "select", options: ["off", "add_header", "overwrite_header"] },
  { id: "rocket_loader", label: "Rocket Loader", desc: "Optimalkan loading JavaScript", type: "onoff" },
  { id: "security_level", label: "Security Level", desc: "Tingkat proteksi dari ancaman", type: "select", options: ["essentially_off", "low", "medium", "high", "under_attack"] },
  { id: "server_side_exclude", label: "Server Side Excludes", desc: "Sembunyikan konten dari visitor mencurigakan", type: "onoff" },
  { id: "ssl", label: "SSL Mode", desc: "Mode enkripsi SSL/TLS", type: "select", options: ["off", "flexible", "full", "strict"] },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    fetchSettings(id);
  };

  const fetchSettings = async (id: string) => {
    setLoading(true);
    const settingIds = KNOWN_SETTINGS.map((s) => s.id);
    const results = await Promise.allSettled(
      settingIds.map((sid) => api.get(`/zones/${id}/settings/${sid}`))
    );
    const newSettings: Record<string, Setting> = {};
    results.forEach((res, i) => {
      if (res.status === "fulfilled" && res.value.ok) {
        const data = (res.value.data as { result: Setting }).result;
        if (data) newSettings[settingIds[i]] = data;
      }
    });
    setSettings(newSettings);
    setLoading(false);
  };

  const updateSetting = async (id: string, value: string | boolean | number) => {
    setSaving(id);
    const res = await api.patch(`/zones/${zoneId}/settings/${id}`, { value });
    if (res.ok) {
      toast({ title: "Pengaturan disimpan" });
      setSettings((p) => ({ ...p, [id]: { ...p[id], value } }));
    } else {
      const err = res.data as { errors?: { message: string }[] };
      toast({ title: err.errors?.[0]?.message ?? "Gagal menyimpan", variant: "destructive" });
    }
    setSaving(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Zone Settings</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName || "Pilih domain untuk mengelola pengaturan"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ZoneSelector value={zoneId} onChange={handleZoneChange} />
          {zoneId && (
            <Button size="icon" variant="outline" onClick={() => fetchSettings(zoneId)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <RefreshCwIcon className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {!zoneId ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-12 text-center">
            <SettingsIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Pilih domain untuk mengelola pengaturan zone</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 bg-gray-900" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {KNOWN_SETTINGS.map((setting) => {
            const data = settings[setting.id];
            if (!data) return null;
            const isOn = data.value === "on" || data.value === true || data.value === 1;
            const strVal = String(data.value ?? "");

            return (
              <Card key={setting.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{setting.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{setting.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {saving === setting.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                      {setting.type === "onoff" && (
                        <Switch
                          checked={isOn}
                          onCheckedChange={(v) => updateSetting(setting.id, v ? "on" : "off")}
                          disabled={!data.editable || saving === setting.id}
                        />
                      )}
                      {setting.type === "select" && (
                        <Select
                          value={strVal}
                          onValueChange={(v) => updateSetting(setting.id, v)}
                          disabled={!data.editable || saving === setting.id}
                        >
                          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            {setting.options?.map((o) => (
                              <SelectItem key={o} value={o} className="text-white hover:bg-gray-700 text-xs">{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {setting.type === "number" && (
                        <span className="text-sm text-orange-400 font-mono">{String(data.value)}</span>
                      )}
                      {!data.editable && (
                        <span className="text-xs text-gray-600">(tidak bisa diubah)</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
