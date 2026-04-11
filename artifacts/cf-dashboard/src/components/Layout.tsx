import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CloudIcon,
  LayoutDashboardIcon,
  GlobeIcon,
  ServerIcon,
  MailIcon,
  ShieldIcon,
  SettingsIcon,
  LogOutIcon,
  MenuIcon,
  XIcon,
  ZapIcon,
  ActivityIcon,
  DatabaseIcon,
  NetworkIcon,
  CodeIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboardIcon, label: "Overview", href: "/" },
  { icon: GlobeIcon, label: "Domains / Zones", href: "/zones" },
  { icon: DatabaseIcon, label: "DNS Records", href: "/dns" },
  { icon: MailIcon, label: "Email Routing", href: "/email" },
  { icon: CodeIcon, label: "Workers & Scripts", href: "/workers" },
  { icon: LayoutTemplateIcon, label: "Pages", href: "/pages" },
  { icon: ZapIcon, label: "Page Rules", href: "/page-rules" },
  { icon: ShieldIcon, label: "Firewall / WAF", href: "/firewall" },
  { icon: NetworkIcon, label: "SSL / TLS", href: "/ssl" },
  { icon: ActivityIcon, label: "Analytics", href: "/analytics" },
  { icon: ServerIcon, label: "Cache", href: "/cache" },
  { icon: SettingsIcon, label: "Zone Settings", href: "/settings" },
];

function NavLink({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) {
  const [location] = useLocation();
  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
  return (
    <Link href={item.href} onClick={onClick}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
          isActive
            ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
            : "text-gray-400 hover:text-white hover:bg-gray-800/60"
        )}
      >
        <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-orange-400" : "text-gray-500")} />
        {item.label}
      </div>
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <CloudIcon className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-bold text-white text-sm tracking-tight">CloudPanel</span>
          <p className="text-xs text-gray-500">elfar.my.id</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
          ))}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t border-gray-800">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm"
          onClick={logout}
        >
          <LogOutIcon className="w-4 h-4" />
          Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-60 shrink-0 flex-col bg-gray-900 border-r border-gray-800">
        {sidebar}
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <Button
            size="icon"
            variant="ghost"
            className="text-gray-400"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center">
              <CloudIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white text-sm">CloudPanel</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-5 min-h-full">
            {children}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
