import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutTemplateIcon, RefreshCwIcon, GlobeIcon, PlusIcon, Trash2Icon,
  ExternalLinkIcon, CheckCircleIcon, XCircleIcon, Loader2, ClockIcon,
  LinkIcon, RocketIcon, GitBranchIcon, CalendarIcon
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  source?: { type: string; config?: { repo_name?: string } };
  latest_deployment?: {
    id: string;
    environment: string;
    deployment_trigger: { metadata?: { commit_message?: string } };
    created_on: string;
    latest_stage: { name: string; status: string };
    url?: string;
  };
  created_on: string;
  modified_on: string;
}

interface PagesDomain {
  id?: string;
  name: string;
  status?: string;
  created_on?: string;
  verification_data?: unknown;
}

interface Deployment {
  id: string;
  environment: string;
  created_on: string;
  deployment_trigger: { type: string; metadata?: { commit_message?: string; branch?: string } };
  latest_stage: { name: string; status: string };
  url?: string;
  short_id?: string;
}

function DeployStatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs shrink-0"><CheckCircleIcon className="w-3 h-3 mr-1" />Success</Badge>;
  if (status === "failure" || status === "failed") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs shrink-0"><XCircleIcon className="w-3 h-3 mr-1" />Failed</Badge>;
  if (status === "active") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs shrink-0"><RocketIcon className="w-3 h-3 mr-1" />Active</Badge>;
  return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs shrink-0"><Loader2 className="w-3 h-3 mr-1 animate-spin" />{status}</Badge>;
}

function DomainStatusBadge({ status }: { status?: string }) {
  if (!status || status === "active") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Active</Badge>;
  if (status === "pending") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Pending</Badge>;
  return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">{status}</Badge>;
}

export default function PagesPage() {
  const { toast } = useToast();
  const [accountId, setAccountId] = useState("");
  const [projects, setProjects] = useState<PagesProject[]>([]);
  const [loading, setLoading] = useState(true);

  // Domain management
  const [domainProject, setDomainProject] = useState<PagesProject | null>(null);
  const [domains, setDomains] = useState<PagesDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [deleteDomain, setDeleteDomain] = useState<PagesDomain | null>(null);

  // Deployments dialog
  const [deployProject, setDeployProject] = useState<PagesProject | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);

  // Delete project
  const [deleteProject, setDeleteProject] = useState<PagesProject | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const fetchProjects = async (accId?: string) => {
    setLoading(true);
    let aid = accId ?? accountId;
    if (!aid) {
      const zonesRes = await api.get("/zones?per_page=1");
      if (zonesRes.ok) {
        const zones = (zonesRes.data as { result: { account: { id: string } }[] }).result;
        if (zones[0]?.account?.id) { aid = zones[0].account.id; setAccountId(aid); }
      }
    }
    if (!aid) { setLoading(false); return; }
    const res = await api.get(`/accounts/${aid}/pages/projects?per_page=100`);
    if (res.ok) setProjects((res.data as { result: PagesProject[] }).result ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const openDomains = async (project: PagesProject) => {
    setDomainProject(project);
    setDomainsLoading(true);
    setDomains([]);
    setNewDomain("");
    const res = await api.get(`/accounts/${accountId}/pages/projects/${project.name}/domains`);
    if (res.ok) setDomains((res.data as { result: PagesDomain[] }).result ?? []);
    setDomainsLoading(false);
  };

  const addDomain = async () => {
    if (!newDomain.trim() || !domainProject) return;
    setAddingDomain(true);
    const res = await api.post(`/accounts/${accountId}/pages/projects/${domainProject.name}/domains`, { name: newDomain.trim() });
    if (res.ok) {
      toast({ title: `Domain ${newDomain} berhasil ditambahkan` });
      setNewDomain("");
      openDomains(domainProject);
    } else {
      toast({ title: "Gagal menambah domain", variant: "destructive" });
    }
    setAddingDomain(false);
  };

  const confirmDeleteDomain = async () => {
    if (!deleteDomain || !domainProject) return;
    const res = await api.delete(`/accounts/${accountId}/pages/projects/${domainProject.name}/domains/${deleteDomain.name}`);
    if (res.ok) {
      toast({ title: `Domain ${deleteDomain.name} dihapus` });
      setDomains((d) => d.filter((x) => x.name !== deleteDomain.name));
    } else {
      toast({ title: "Gagal menghapus domain", variant: "destructive" });
    }
    setDeleteDomain(null);
  };

  const openDeployments = async (project: PagesProject) => {
    setDeployProject(project);
    setDeploymentsLoading(true);
    setDeployments([]);
    const res = await api.get(`/accounts/${accountId}/pages/projects/${project.name}/deployments?per_page=10`);
    if (res.ok) setDeployments((res.data as { result: Deployment[] }).result ?? []);
    setDeploymentsLoading(false);
  };

  const openDeleteProject = (project: PagesProject) => {
    setDeleteProject(project);
    setDeleteConfirmName("");
  };

  const confirmDeleteProject = async () => {
    if (!deleteProject || deleteConfirmName !== deleteProject.name) return;
    setDeletingProject(true);
    const res = await api.delete(`/accounts/${accountId}/pages/projects/${deleteProject.name}`);
    if (res.ok) {
      toast({ title: `Project "${deleteProject.name}" berhasil dihapus` });
      setProjects((p) => p.filter((x) => x.name !== deleteProject.name));
      setDeleteProject(null);
    } else {
      toast({ title: "Gagal menghapus project", variant: "destructive" });
    }
    setDeletingProject(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Pages Projects</h1>
          <p className="text-gray-400 text-sm mt-0.5">{projects.length} project</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchProjects()} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 shrink-0">
          <RefreshCwIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-gray-800 rounded-lg" />)}</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <LayoutTemplateIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Belum ada Pages project</p>
              <p className="text-xs text-gray-600 mt-1">Buat project di dashboard Cloudflare</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {projects.map((project) => {
                const latestStage = project.latest_deployment?.latest_stage;
                const prodUrl = project.subdomain ? `https://${project.subdomain}.pages.dev` : null;
                const repo = project.source?.config?.repo_name;
                return (
                  <div key={project.id} className="p-3 sm:p-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <LayoutTemplateIcon className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">{project.name}</p>
                          {latestStage && <DeployStatusBadge status={latestStage.status} />}
                        </div>
                        {prodUrl && (
                          <a href={prodUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5 w-fit">
                            <ExternalLinkIcon className="w-3 h-3" />
                            {project.subdomain}.pages.dev
                          </a>
                        )}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {repo && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <GitBranchIcon className="w-3 h-3" />{repo}
                            </p>
                          )}
                          {project.domains?.length > 0 && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <GlobeIcon className="w-3 h-3" />{project.domains.length} custom domain
                            </p>
                          )}
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />{formatDate(project.created_on)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost"
                          className="h-8 px-2 text-xs text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 gap-1"
                          onClick={() => openDeployments(project)}>
                          <RocketIcon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Deploy</span>
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-8 px-2 text-xs text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 gap-1"
                          onClick={() => openDomains(project)}>
                          <GlobeIcon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Domain</span>
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => openDeleteProject(project)}
                          title="Hapus project">
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Domains Dialog */}
      <Dialog open={!!domainProject} onOpenChange={(o) => !o && setDomainProject(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GlobeIcon className="w-4 h-4 text-orange-400" />
              Custom Domains — {domainProject?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="contoh.com atau sub.contoh.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 flex-1"
            />
            <Button onClick={addDomain} disabled={addingDomain || !newDomain.trim()} className="bg-orange-500 hover:bg-orange-600 shrink-0">
              {addingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {domainsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : domains.length === 0 ? (
              <div className="text-center py-8">
                <LinkIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Belum ada custom domain</p>
              </div>
            ) : (
              domains.map((d) => (
                <div key={d.name} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{d.name}</p>
                    <DomainStatusBadge status={d.status} />
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                    onClick={() => setDeleteDomain(d)}>
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {domainProject?.subdomain && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <ExternalLinkIcon className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-xs text-blue-400 font-mono truncate">{domainProject.subdomain}.pages.dev</p>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs shrink-0">Default</Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deployments Dialog */}
      <Dialog open={!!deployProject} onOpenChange={(o) => !o && setDeployProject(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RocketIcon className="w-4 h-4 text-blue-400" />
              Deployments — {deployProject?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {deploymentsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : deployments.length === 0 ? (
              <div className="text-center py-8">
                <RocketIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Belum ada deployment</p>
              </div>
            ) : (
              deployments.map((d) => {
                const msg = d.deployment_trigger?.metadata?.commit_message;
                const branch = d.deployment_trigger?.metadata?.branch;
                return (
                  <div key={d.id} className="p-3 bg-gray-800/50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <DeployStatusBadge status={d.latest_stage?.status} />
                        <Badge className={cn("text-xs shrink-0", d.environment === "production"
                          ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                          : "bg-gray-700 text-gray-300 border-gray-600"
                        )}>{d.environment}</Badge>
                      </div>
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 shrink-0">
                          <ExternalLinkIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    {msg && <p className="text-xs text-gray-300 truncate">{msg}</p>}
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      {formatDate(d.created_on)}
                      {branch && <span className="ml-1 text-gray-600">· {branch}</span>}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete domain confirm */}
      <AlertDialog open={!!deleteDomain} onOpenChange={(o) => !o && setDeleteDomain(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Custom Domain</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Hapus domain <strong className="text-white">{deleteDomain?.name}</strong> dari project <strong className="text-white">{domainProject?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDomain} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete project confirm */}
      <Dialog open={!!deleteProject} onOpenChange={(o) => { if (!o) setDeleteProject(null); }}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2Icon className="w-4 h-4" /> Hapus Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Ini akan <strong className="text-red-400">menghapus permanen</strong> project{" "}
              <strong className="text-white">{deleteProject?.name}</strong> beserta semua deployment dan custom domain-nya.
            </p>
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">
                Ketik <strong className="text-white font-mono">{deleteProject?.name}</strong> untuk konfirmasi
              </p>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteProject?.name}
                className="bg-gray-800 border-gray-700 text-white font-mono placeholder:text-gray-600"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeleteProject(null)} className="text-gray-400">Batal</Button>
              <Button
                onClick={confirmDeleteProject}
                disabled={deletingProject || deleteConfirmName !== deleteProject?.name}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              >
                {deletingProject ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Hapus Project
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
