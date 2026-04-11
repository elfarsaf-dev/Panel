import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ZoneSelector, { type Zone } from "@/components/ZoneSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityIcon, TrendingUpIcon, UsersIcon, ShieldIcon, ZapIcon } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface AnalyticsBucket {
  since: string;
  until: string;
  totals: {
    requests: { all: number; cached: number; uncached: number };
    bandwidth: { all: number; cached: number; uncached: number };
    threats: { all: number };
    pageviews: { all: number };
    uniques: { all: number };
  };
}

export default function AnalyticsPage() {
  const [zoneId, setZoneId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsBucket | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("-10080"); // 7 days in minutes

  const handleZoneChange = (id: string, zone: Zone) => {
    setZoneId(id);
    setZoneName(zone.name);
    fetchAnalytics(id, period);
  };

  const fetchAnalytics = async (id: string, since: string) => {
    if (!id) return;
    setLoading(true);
    const res = await api.get(`/zones/${id}/analytics/dashboard?since=${since}&until=0&continuous=true`);
    if (res.ok) {
      const data = (res.data as { result: AnalyticsBucket }).result;
      setAnalytics(data);
    }
    setLoading(false);
  };

  const handlePeriodChange = (val: string) => {
    setPeriod(val);
    if (zoneId) fetchAnalytics(zoneId, val);
  };

  const totals = analytics?.totals;

  const stats = [
    {
      label: "Total Requests",
      value: totals ? totals.requests.all.toLocaleString() : "-",
      sub: totals ? `${totals.requests.cached.toLocaleString()} cached` : "",
      icon: ActivityIcon,
      color: "blue",
    },
    {
      label: "Bandwidth",
      value: totals ? formatBytes(totals.bandwidth.all) : "-",
      sub: totals ? `${formatBytes(totals.bandwidth.cached)} cached` : "",
      icon: TrendingUpIcon,
      color: "purple",
    },
    {
      label: "Unique Visitors",
      value: totals ? totals.uniques.all.toLocaleString() : "-",
      sub: totals ? `${totals.pageviews.all.toLocaleString()} pageviews` : "",
      icon: UsersIcon,
      color: "green",
    },
    {
      label: "Threats Blocked",
      value: totals ? totals.threats.all.toLocaleString() : "-",
      sub: "ancaman diblokir",
      icon: ShieldIcon,
      color: "red",
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: "bg-blue-500/10", icon: "text-blue-400" },
    purple: { bg: "bg-purple-500/10", icon: "text-purple-400" },
    green: { bg: "bg-green-500/10", icon: "text-green-400" },
    red: { bg: "bg-red-500/10", icon: "text-red-400" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">{zoneName || "Pilih domain untuk melihat analytics"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-36 bg-gray-800 border-gray-700 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="-1440" className="text-white hover:bg-gray-700">24 jam</SelectItem>
              <SelectItem value="-10080" className="text-white hover:bg-gray-700">7 hari</SelectItem>
              <SelectItem value="-43200" className="text-white hover:bg-gray-700">30 hari</SelectItem>
            </SelectContent>
          </Select>
          <ZoneSelector value={zoneId} onChange={handleZoneChange} />
        </div>
      </div>

      {!zoneId ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-12 text-center">
            <ActivityIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Pilih domain untuk melihat statistik traffic</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const colors = colorMap[stat.color];
              return (
                <Card key={stat.label} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-xs text-gray-400">{stat.label}</p>
                      <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
                        <stat.icon className={`w-4 h-4 ${colors.icon}`} />
                      </div>
                    </div>
                    {loading ? (
                      <Skeleton className="h-8 w-24 bg-gray-800" />
                    ) : (
                      <>
                        <p className="text-xl font-bold text-white">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Cache hit rate */}
          {totals && !loading && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <ZapIcon className="w-4 h-4 text-orange-400" />
                  Cache Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">Cache Hit Rate</span>
                      <span className="text-white font-medium">
                        {totals.requests.all > 0
                          ? `${Math.round((totals.requests.cached / totals.requests.all) * 100)}%`
                          : "0%"}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-700"
                        style={{
                          width: totals.requests.all > 0
                            ? `${Math.round((totals.requests.cached / totals.requests.all) * 100)}%`
                            : "0%"
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Cached Requests", value: totals.requests.cached.toLocaleString(), color: "text-green-400" },
                      { label: "Uncached", value: totals.requests.uncached.toLocaleString(), color: "text-yellow-400" },
                      { label: "Cached BW", value: formatBytes(totals.bandwidth.cached), color: "text-blue-400" },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-800/50 p-3 rounded-lg text-center">
                        <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
