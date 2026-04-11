import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobeIcon, ShieldIcon, ZapIcon, AlertCircleIcon, CheckCircleIcon, PauseCircleIcon, ArrowRightIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  plan: { name: string };
  owner: { name: string };
  created_on: string;
  modified_on: string;
}

function ZoneStatusBadge({ status, paused }: { status: string; paused: boolean }) {
  if (paused) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs shrink-0"><PauseCircleIcon className="w-3 h-3 mr-1" />Paused</Badge>;
  if (status === "active") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs shrink-0"><CheckCircleIcon className="w-3 h-3 mr-1" />Active</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs shrink-0"><AlertCircleIcon className="w-3 h-3 mr-1" />{status}</Badge>;
}

export default function OverviewPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/zones?per_page=50").then((res) => {
      if (res.ok) {
        setZones((res.data as { result: Zone[] }).result ?? []);
      } else {
        setError("Gagal memuat data domain");
      }
      setLoading(false);
    }).catch(() => {
      setError("Gagal terhubung ke API");
      setLoading(false);
    });
  }, []);

  const activeZones = zones.filter((z) => z.status === "active" && !z.paused).length;
  const pausedZones = zones.filter((z) => z.paused).length;
  const inactiveZones = zones.filter((z) => z.status !== "active").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Ringkasan semua domain dan resource Cloudflare kamu</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Domain", value: zones.length, color: "text-white", bg: "bg-blue-500/10", icon: GlobeIcon, iconColor: "text-blue-400" },
          { label: "Aktif", value: activeZones, color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircleIcon, iconColor: "text-green-400" },
          { label: "Paused", value: pausedZones, color: "text-yellow-400", bg: "bg-yellow-500/10", icon: PauseCircleIcon, iconColor: "text-yellow-400" },
          { label: "Non-Aktif", value: inactiveZones, color: "text-red-400", bg: "bg-red-500/10", icon: AlertCircleIcon, iconColor: "text-red-400" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 truncate">{stat.label}</p>
                  {loading
                    ? <Skeleton className="h-7 w-10 mt-1 bg-gray-800" />
                    : <p className={cn("text-2xl font-bold mt-1", stat.color)}>{stat.value}</p>
                  }
                </div>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", stat.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Zones list */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 pt-4">
          <CardTitle className="text-white text-base">Domain List</CardTitle>
          <Link href="/zones">
            <Button size="sm" variant="ghost" className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1 text-xs">
              Lihat Semua <ArrowRightIcon className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-3">
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-gray-800 rounded-lg" />
              ))}
            </div>
          )}
          {error && <p className="text-red-400 text-sm px-1">{error}</p>}
          {!loading && !error && (
            <div className="space-y-1.5">
              {zones.slice(0, 8).map((zone) => (
                <Link key={zone.id} href={`/dns?zone=${zone.id}&name=${encodeURIComponent(zone.name)}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 active:bg-gray-700 transition-colors cursor-pointer">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      zone.status === "active" && !zone.paused ? "bg-green-500/10" : "bg-gray-700"
                    )}>
                      <GlobeIcon className={cn("w-4 h-4", zone.status === "active" && !zone.paused ? "text-green-400" : "text-gray-400")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{zone.name}</p>
                      <p className="text-xs text-gray-500">{zone.plan?.name ?? "Free"}</p>
                    </div>
                    <ZoneStatusBadge status={zone.status} paused={zone.paused} />
                  </div>
                </Link>
              ))}
              {zones.length === 0 && (
                <div className="text-center py-8">
                  <GlobeIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Belum ada domain yang terdaftar</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: GlobeIcon, label: "Kelola DNS", desc: "Edit records", href: "/dns", color: "blue" },
          { icon: ShieldIcon, label: "Firewall", desc: "Atur proteksi", href: "/firewall", color: "red" },
          { icon: ZapIcon, label: "Workers", desc: "Deploy script", href: "/workers", color: "purple" },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800/80 active:bg-gray-800 transition-all cursor-pointer group h-full">
              <CardContent className="p-3 sm:p-4">
                <div className={cn(
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center mb-2 sm:mb-3",
                  action.color === "blue" ? "bg-blue-500/10" : action.color === "red" ? "bg-red-500/10" : "bg-purple-500/10"
                )}>
                  <action.icon className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5",
                    action.color === "blue" ? "text-blue-400" : action.color === "red" ? "text-red-400" : "text-purple-400"
                  )} />
                </div>
                <p className="text-xs sm:text-sm font-medium text-white group-hover:text-orange-400 transition-colors leading-tight">{action.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{action.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
