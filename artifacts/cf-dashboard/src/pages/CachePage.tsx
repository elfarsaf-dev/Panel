import { useState } from "react";
import { api } from "@/lib/api";
import ZoneSelector, { type Zone } from "@/components/ZoneSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ServerIcon, TrashIcon, Loader2, ZapIcon, CheckCircle2Icon } from "lucide-react";

export default function CachePage() {
  const { toast } = useToast();
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeType, setPurgeType] = useState<"all" | "files">("all");
  const [files, setFiles] = useState("");
  const [tags, setTags] = useState("");
  const [success, setSuccess] = useState(false);

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    setSuccess(false);
  };

  const purgeAll = async () => {
    setPurging(true);
    setSuccess(false);
    const res = await api.post(`/zones/${zoneId}/purge_cache`, { purge_everything: true });
    if (res.ok) {
      toast({ title: "Semua cache berhasil di-purge!" });
      setSuccess(true);
    } else {
      const err = res.data as { errors?: { message: string }[] };
      toast({ title: err.errors?.[0]?.message ?? "Gagal purge cache", variant: "destructive" });
    }
    setPurging(false);
  };

  const purgeFiles = async () => {
    const fileList = files.split("\n").map((f) => f.trim()).filter(Boolean);
    if (fileList.length === 0) {
      toast({ title: "Masukkan URL file yang ingin di-purge", variant: "destructive" });
      return;
    }
    setPurging(true);
    setSuccess(false);
    const res = await api.post(`/zones/${zoneId}/purge_cache`, { files: fileList });
    if (res.ok) {
      toast({ title: `${fileList.length} URL berhasil di-purge` });
      setSuccess(true);
      setFiles("");
    } else {
      toast({ title: "Gagal purge URL", variant: "destructive" });
    }
    setPurging(false);
  };

  const purgeTags = async () => {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length === 0) {
      toast({ title: "Masukkan cache tag", variant: "destructive" });
      return;
    }
    setPurging(true);
    setSuccess(false);
    const res = await api.post(`/zones/${zoneId}/purge_cache`, { tags: tagList });
    if (res.ok) {
      toast({ title: "Cache tags berhasil di-purge" });
      setSuccess(true);
      setTags("");
    } else {
      toast({ title: "Gagal purge tags (perlu Business/Enterprise plan)", variant: "destructive" });
    }
    setPurging(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Cache</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName || "Pilih domain untuk mengelola cache"}</p>
        </div>
        <ZoneSelector value={zoneId} onChange={handleZoneChange} />
      </div>

      {!zoneId ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-12 text-center">
            <ServerIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Pilih domain untuk mengelola cache</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle2Icon className="w-4 h-4" />
              Cache berhasil di-purge. Perubahan akan berlaku segera.
            </div>
          )}

          {/* Purge everything */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrashIcon className="w-4 h-4 text-red-400" />
                Purge Everything
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-400">
                Hapus <strong className="text-white">semua</strong> file yang di-cache untuk domain ini. Pengunjung berikutnya akan menerima konten segar dari origin server.
              </p>
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
                Perhatian: Ini akan meningkatkan beban ke origin server sementara. Gunakan dengan bijak.
              </div>
              <Button
                onClick={purgeAll}
                disabled={purging}
                className="bg-red-600 hover:bg-red-700 gap-2"
              >
                {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrashIcon className="w-4 h-4" />}
                Purge All Cache
              </Button>
            </CardContent>
          </Card>

          {/* Purge specific files */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ZapIcon className="w-4 h-4 text-orange-400" />
                Purge File Tertentu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">URL (satu per baris)</Label>
                <textarea
                  value={files}
                  onChange={(e) => setFiles(e.target.value)}
                  rows={4}
                  placeholder={`https://${zoneName}/style.css\nhttps://${zoneName}/images/logo.png`}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm p-3 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none font-mono"
                />
              </div>
              <Button onClick={purgeFiles} disabled={purging || !files.trim()} className="bg-orange-500 hover:bg-orange-600 gap-2">
                {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZapIcon className="w-4 h-4" />}
                Purge URL
              </Button>
            </CardContent>
          </Card>

          {/* Purge by tags */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ServerIcon className="w-4 h-4 text-blue-400" />
                Purge by Cache Tag
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">Cache tag purge memerlukan Business atau Enterprise plan.</p>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-xs">Cache Tags (pisah dengan koma)</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="bg-gray-800 border-gray-700 text-white font-mono"
                />
              </div>
              <Button onClick={purgeTags} disabled={purging || !tags.trim()} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Purge Tags
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
