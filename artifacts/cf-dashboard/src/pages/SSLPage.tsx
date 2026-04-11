import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ZoneSelector, { type Zone } from "@/components/ZoneSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { NetworkIcon, ShieldCheckIcon, Loader2, CheckCircle2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const SSL_MODES = [
  { value: "off", label: "Off", desc: "Tidak ada enkripsi" },
  { value: "flexible", label: "Flexible", desc: "Enkripsi antara browser dan Cloudflare" },
  { value: "full", label: "Full", desc: "Enkripsi end-to-end, sertifikat tidak divalidasi" },
  { value: "strict", label: "Full (Strict)", desc: "Enkripsi end-to-end dengan sertifikat valid" },
];

const SSL_MODE_COLORS: Record<string, string> = {
  off: "bg-red-500/20 text-red-400 border-red-500/30",
  flexible: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  full: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  strict: "bg-green-500/20 text-green-400 border-green-500/30",
};

interface ZoneSetting {
  id: string;
  value: string | boolean | number;
  modified_on: string;
}

export default function SSLPage() {
  const { toast } = useToast();
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [settings, setSettings] = useState<Record<string, ZoneSetting>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    fetchSettings(id);
  };

  const fetchSettings = async (id: string) => {
    setLoading(true);
    const settingIds = ["ssl", "always_use_https", "automatic_https_rewrites", "min_tls_version", "tls_1_3", "http2", "http3", "0rtt", "hsts"];
    const results = await Promise.allSettled(
      settingIds.map((s) => api.get(`/zones/${id}/settings/${s}`))
    );
    const newSettings: Record<string, ZoneSetting> = {};
    results.forEach((res, i) => {
      if (res.status === "fulfilled" && res.value.ok) {
        const data = (res.value.data as { result: ZoneSetting }).result;
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
      toast({ title: "Pengaturan SSL diperbarui" });
      setSettings((p) => ({ ...p, [id]: { ...p[id], value } }));
    } else {
      toast({ title: "Gagal memperbarui pengaturan", variant: "destructive" });
    }
    setSaving(null);
  };

  const sslMode = String(settings.ssl?.value ?? "off");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">SSL / TLS</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName || "Pilih domain untuk mengelola SSL/TLS"}</p>
        </div>
        <ZoneSelector value={zoneId} onChange={handleZoneChange} />
      </div>

      {!zoneId ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-12 text-center">
            <ShieldCheckIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Pilih domain untuk melihat pengaturan SSL/TLS</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-gray-900" />)}</div>
      ) : (
        <div className="space-y-4">
          {/* SSL Mode */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <NetworkIcon className="w-4 h-4 text-orange-400" />
                Mode SSL/TLS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {SSL_MODES.map((mode) => (
                  <div
                    key={mode.value}
                    onClick={() => updateSetting("ssl", mode.value)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      sslMode === mode.value
                        ? "border-orange-500/50 bg-orange-500/10"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{mode.label}</span>
                      {sslMode === mode.value && <CheckCircle2Icon className="w-4 h-4 text-orange-400" />}
                    </div>
                    <p className="text-xs text-gray-400">{mode.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-gray-800/50">
                <span className="text-xs text-gray-400">Status saat ini:</span>
                <Badge className={cn("text-xs", SSL_MODE_COLORS[sslMode] ?? "bg-gray-500/20 text-gray-400")}>
                  {SSL_MODES.find(m => m.value === sslMode)?.label ?? sslMode}
                </Badge>
                {saving === "ssl" && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-auto" />}
              </div>
            </CardContent>
          </Card>

          {/* Toggle settings */}
          {[
            { id: "always_use_https", label: "Always Use HTTPS", desc: "Redirect semua HTTP ke HTTPS" },
            { id: "automatic_https_rewrites", label: "Automatic HTTPS Rewrites", desc: "Ganti URL HTTP dalam halaman menjadi HTTPS" },
            { id: "tls_1_3", label: "TLS 1.3", desc: "Enable TLS 1.3 untuk koneksi lebih aman dan cepat" },
            { id: "http2", label: "HTTP/2", desc: "Enable HTTP/2 untuk performa lebih baik" },
            { id: "http3", label: "HTTP/3 (QUIC)", desc: "Enable HTTP/3 untuk latensi lebih rendah" },
            { id: "0rtt", label: "0-RTT Connection Resumption", desc: "Kurangi latensi dengan 0-RTT (perlu mitigasi replay attack)" },
          ].map((setting) => {
            const val = settings[setting.id]?.value;
            const isOn = val === "on" || val === true || val === 1;
            return (
              <Card key={setting.id} className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{setting.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{setting.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {saving === setting.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                      <Switch
                        checked={isOn}
                        onCheckedChange={(v) => updateSetting(setting.id, v ? "on" : "off")}
                        disabled={saving === setting.id || !settings[setting.id]}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Min TLS Version */}
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Minimum TLS Version</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tolak koneksi TLS di bawah versi ini</p>
                </div>
                <div className="flex items-center gap-2">
                  {saving === "min_tls_version" && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                  <Select
                    value={String(settings.min_tls_version?.value ?? "1.0")}
                    onValueChange={(v) => updateSetting("min_tls_version", v)}
                    disabled={!settings.min_tls_version}
                  >
                    <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {["1.0", "1.1", "1.2", "1.3"].map((v) => (
                        <SelectItem key={v} value={v} className="text-white hover:bg-gray-700">TLS {v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
