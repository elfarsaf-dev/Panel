import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlobeIcon, Loader2 } from "lucide-react";

export interface Zone {
  id: string;
  name: string;
  status: string;
  plan: { name: string };
  paused: boolean;
}

interface ZoneSelectorProps {
  value: string;
  onChange: (zoneId: string, zone: Zone) => void;
}

export default function ZoneSelector({ value, onChange }: ZoneSelectorProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/zones?per_page=50").then((res) => {
      if (res.ok) {
        const result = (res.data as { result: Zone[] }).result ?? [];
        setZones(result);
        if (result.length > 0 && !value) {
          onChange(result[0].id, result[0]);
        }
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Memuat domain...
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(id) => {
        const zone = zones.find((z) => z.id === id);
        if (zone) onChange(id, zone);
      }}
    >
      <SelectTrigger className="w-56 bg-gray-800 border-gray-700 text-white">
        <GlobeIcon className="w-4 h-4 mr-2 text-orange-400" />
        <SelectValue placeholder="Pilih domain..." />
      </SelectTrigger>
      <SelectContent className="bg-gray-800 border-gray-700">
        {zones.map((zone) => (
          <SelectItem key={zone.id} value={zone.id} className="text-white hover:bg-gray-700">
            {zone.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { ZoneSelector };
