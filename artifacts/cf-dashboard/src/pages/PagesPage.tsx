import { useEffect, useState, useRef } from "react";
import { api, CLOUDFLARE_ACCOUNT_ID } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutTemplateIcon, RefreshCwIcon, GlobeIcon, PlusIcon, Trash2Icon,
  ExternalLinkIcon, CheckCircleIcon, XCircleIcon, Loader2, ClockIcon,
  LinkIcon, RocketIcon, GitBranchIcon, CalendarIcon, AlertCircleIcon,
  ChevronRightIcon, ChevronLeftIcon, FolderGitIcon, TerminalIcon, FolderIcon
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  source?: { type: string; config?: { repo_name?: string; owner?: string } };
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
}

interface Zone {
  id: string;
  name: string;
}

interface Deployment {
  id: string;
  environment: string;
  created_on: string;
  deployment_trigger: { type: string; metadata?: { commit_message?: string; branch?: string } };
  latest_stage: { name: string; status: string };
  stages?: { name: string; status: string; started_on?: string; ended_on?: string }[];
  url?: string;
  short_id?: string;
}

interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
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

const STAGE_ORDER = ["queued", "initialize", "clone_repo", "build", "deploy"];
const STAGE_LABEL: Record<string, string> = {
  queued: "Antrian",
  initialize: "Inisialisasi",
  clone_repo: "Clone Repo",
  build: "Build",
  deploy: "Deploy",
};

export default function PagesPage() {
  const { toast } = useToast();
  const [accountId] = useState(CLOUDFLARE_ACCOUNT_ID);
  const [projects, setProjects] = useState<PagesProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [domainProject, setDomainProject] = useState<PagesProject | null>(null);
  const [domains, setDomains] = useState<PagesDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainZoneId, setDomainZoneId] = useState("");
  const [domainSubdomain, setDomainSubdomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [deleteDomain, setDeleteDomain] = useState<PagesDomain | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);

  const [deployProject, setDeployProject] = useState<PagesProject | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [deploymentsLoading, setDeploymentsLoading] = useState(false);

  const [deleteProject, setDeleteProject] = useState<PagesProject | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [manualRepo, setManualRepo] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [formBranch, setFormBranch] = useState("main");
  const [formProjectName, setFormProjectName] = useState("");
  const [formBuildCmd, setFormBuildCmd] = useState("");
  const [formOutputDir, setFormOutputDir] = useState("");
  const [formRootDir, setFormRootDir] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdDeployment, setCreatedDeployment] = useState<Deployment | null>(null);
  const [deployPollLoading, setDeployPollLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProjects = async (accId?: string) => {
    setLoading(true);
    setFetchError("");
    const aid = accId ?? accountId;
    const res = await api.get(`/accounts/${aid}/pages/projects`);
    if (res.ok) {
      const result = (res.data as { result: PagesProject[] }).result ?? [];
      setProjects(result);
    } else {
      const errMsg = (res.data as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Gagal mengambil data";
      setFetchError(`Error ${res.status}: ${errMsg}`);
    }
    setLoading(false);
  };

  const fetchZones = async () => {
    const res = await api.get("/zones?per_page=50");
    if (res.ok) {
      const zlist = (res.data as { result: Zone[] }).result ?? [];
      setZones(zlist);
      if (zlist.length > 0) {
        setDomainZoneId((prev) => prev || zlist[0].id);
      }
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchZones();
  }, []);

  const openDomains = async (project: PagesProject) => {
    setDomainProject(project);
    setDomainsLoading(true);
    setDomains([]);
    setDomainZoneId((prev) => prev || zones[0]?.id || "");
    setDomainSubdomain("");
    const res = await api.get(`/accounts/${accountId}/pages/projects/${project.name}/domains`);
    if (res.ok) setDomains((res.data as { result: PagesDomain[] }).result ?? []);
    setDomainsLoading(false);
  };

  const addDomain = async () => {
    if (!domainProject) return;
    const selectedZone = zones.find((z) => z.id === domainZoneId) || zones[0];
    if (!selectedZone) {
      toast({ title: "Pilih domain terlebih dahulu", variant: "destructive" });
      return;
    }

    const cleanSub = domainSubdomain.trim().toLowerCase();
    let hostname = selectedZone.name;
    if (cleanSub && cleanSub !== "@") {
      if (cleanSub.endsWith(`.${selectedZone.name}`)) {
        hostname = cleanSub;
      } else {
        hostname = `${cleanSub}.${selectedZone.name}`;
      }
    }

    setAddingDomain(true);
    try {
      const res = await api.post(`/accounts/${accountId}/pages/projects/${domainProject.name}/domains`, {
        name: hostname,
      });

      if (res.ok) {
        toast({ title: `Domain "${hostname}" berhasil dihubungkan ke Pages!` });
        setDomainSubdomain("");
        openDomains(domainProject);
      } else {
        let errMsg = "Gagal menambah domain";
        try {
          const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
          if (data?.errors?.length) {
            errMsg = data.errors.map((e: { message: string }) => e.message).join(", ");
          }
        } catch {}
        toast({ title: "Gagal menambah domain", description: errMsg, variant: "destructive" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Koneksi terputus";
      toast({ title: "Gagal menambah domain", description: message, variant: "destructive" });
    }
    setAddingDomain(false);
  };

  const confirmDeleteDomain = async () => {
    if (!deleteDomain || !domainProject) return;
    try {
      const res = await api.delete(`/accounts/${accountId}/pages/projects/${domainProject.name}/domains/${deleteDomain.name}`);
      if (res.ok) {
        toast({ title: `Domain "${deleteDomain.name}" dihapus` });
        setDomains((d) => d.filter((x) => x.name !== deleteDomain.name));
      } else {
        let errMsg = "Gagal menghapus domain";
        try {
          const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
          if (data?.errors?.length) {
            errMsg = data.errors.map((e: { message: string }) => e.message).join(", ");
          }
        } catch {}
        toast({ title: "Gagal menghapus domain", description: errMsg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal menghapus domain", variant: "destructive" });
    }
    setDeleteDomain(null);
  };

  const openDeployments = async (project: PagesProject) => {
    setDeployProject(project);
    setDeploymentsLoading(true);
    setDeployments([]);
    const res = await api.get(`/accounts/${accountId}/pages/projects/${project.name}/deployments`);
    if (res.ok) setDeployments((res.data as { result: Deployment[] }).result ?? []);
    setDeploymentsLoading(false);
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

  const openCreate = async () => {
    setCreateStep(1);
    setSelectedRepo(null);
    setManualRepo("");
    setUseManual(false);
    setRepoSearch("");
    setFormBranch("main");
    setFormProjectName("");
    setFormBuildCmd("");
    setFormOutputDir("");
    setFormRootDir("");
    setCreatedDeployment(null);
    setCreateOpen(true);
    loadGithubRepos();
  };

  const loadGithubRepos = async () => {
    setReposLoading(true);
    setGithubRepos([]);
    const res = await api.get(`/accounts/${accountId}/pages/github/repos`);
    if (res.ok) {
      const repos = (res.data as { result: GithubRepo[] }).result ?? [];
      setGithubRepos(repos);
      if (repos.length === 0) setUseManual(true);
    } else {
      setUseManual(true);
    }
    setReposLoading(false);
  };

  const handleSelectRepo = (repo: GithubRepo) => {
    setSelectedRepo(repo);
    setFormBranch(repo.default_branch || "main");
    setFormProjectName(repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  };

  const getRepoDetails = () => {
    if (useManual) {
      const parts = manualRepo.trim().split("/");
      return { owner: parts[0] ?? "", repo: parts[1] ?? "" };
    }
    const parts = selectedRepo?.full_name.split("/") ?? [];
    return { owner: parts[0] ?? "", repo: parts[1] ?? "" };
  };

  const startCreateProject = async () => {
    const { owner, repo } = getRepoDetails();
    if (!owner || !repo || !formProjectName.trim()) return;
    setCreating(true);
    const body = {
      name: formProjectName.trim(),
      production_branch: formBranch || "main",
      source: {
        type: "github",
        config: {
          owner,
          repo_name: repo,
          production_branch: formBranch || "main",
          pr_comments_enabled: true,
          deployments_enabled: true,
        },
      },
      build_config: {
        build_command: formBuildCmd || null,
        destination_dir: formOutputDir || null,
        root_dir: formRootDir || null,
      },
    };
    const res = await api.post(`/accounts/${accountId}/pages/projects`, body);
    if (!res.ok) {
      const errMsg = (res.data as { errors?: { message: string }[] })?.errors?.[0]?.message ?? "Gagal membuat project";
      toast({ title: "Gagal membuat project", description: errMsg, variant: "destructive" });
      setCreating(false);
      return;
    }
    const deployRes = await api.post(`/accounts/${accountId}/pages/projects/${formProjectName.trim()}/deployments`, {});
    if (deployRes.ok) {
      const dep = (deployRes.data as { result: Deployment }).result;
      setCreatedDeployment(dep);
      setCreateStep(3);
      startPollingDeployment(formProjectName.trim(), dep.id);
    } else {
      toast({ title: "Project dibuat! Tapi gagal trigger deployment otomatis.", variant: "destructive" });
      setCreateStep(3);
    }
    setCreating(false);
    fetchProjects(accountId);
  };

  const startPollingDeployment = (projectName: string, deployId: string) => {
    setDeployPollLoading(true);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await api.get(`/accounts/${accountId}/pages/projects/${projectName}/deployments/${deployId}`);
      if (res.ok) {
        const dep = (res.data as { result: Deployment }).result;
        setCreatedDeployment(dep);
        const finalStatus = dep.latest_stage?.status;
        if (finalStatus === "success" || finalStatus === "failure" || finalStatus === "failed") {
          clearInterval(pollRef.current!);
          setDeployPollLoading(false);
          fetchProjects(accountId);
        }
      }
    }, 5000);
  };

  const closeCreate = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setCreateOpen(false);
  };

  const filteredRepos = githubRepos.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const canProceedStep1 = useManual ? manualRepo.includes("/") : !!selectedRepo;
  const canProceedStep2 = !!formProjectName.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-white">Pages Projects</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">{projects.length} project</p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => fetchProjects()} className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-1.5 shrink-0 h-8 px-2 text-xs">
            <RefreshCwIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 gap-1.5 shrink-0 h-8 px-2 text-xs">
            <PlusIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buat Project</span>
            <span className="sm:hidden">Buat</span>
          </Button>
        </div>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-gray-800 rounded-lg" />)}</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 px-4">
              <LayoutTemplateIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Belum ada Pages project</p>
              {fetchError && (
                <div className="mt-3 text-left max-w-md mx-auto p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400 flex items-start gap-1.5">
                    <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {fetchError}
                  </p>
                </div>
              )}
              <Button size="sm" onClick={openCreate} className="mt-4 bg-orange-500 hover:bg-orange-600 gap-1.5">
                <PlusIcon className="w-4 h-4" /> Buat Project Baru
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {projects.map((project) => {
                const latestStage = project.latest_deployment?.latest_stage;
                const prodUrl = project.subdomain ? `https://${project.subdomain}.pages.dev` : null;
                const repo = project.source?.config?.repo_name;
                const owner = project.source?.config?.owner;
                return (
                  <div key={project.id} className="p-2.5 sm:p-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <LayoutTemplateIcon className="w-3.5 h-3.5 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] sm:text-sm font-semibold text-white truncate max-w-[160px] sm:max-w-none">{project.name}</p>
                          {latestStage && <DeployStatusBadge status={latestStage.status} />}
                        </div>
                        {prodUrl && (
                          <a href={prodUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] sm:text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5 w-fit truncate max-w-[180px] sm:max-w-[220px]">
                            <ExternalLinkIcon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{project.subdomain}.pages.dev</span>
                          </a>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {repo && (
                            <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                              <FolderGitIcon className="w-2.5 h-2.5 shrink-0" />{owner ? `${owner}/${repo}` : repo}
                            </p>
                          )}
                          {project.domains?.length > 0 && (
                            <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                              <GlobeIcon className="w-2.5 h-2.5" />{project.domains.length} custom domain
                            </p>
                          )}
                          <p className="text-[10px] sm:text-xs text-gray-600 flex items-center gap-1">
                            <CalendarIcon className="w-2.5 h-2.5" />{formatDate(project.created_on)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost"
                          className="h-7 px-1.5 text-[11px] text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 gap-1"
                          onClick={() => openDeployments(project)}>
                          <RocketIcon className="w-3 h-3" />
                          <span className="hidden sm:inline">Deploy</span>
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-7 px-1.5 text-[11px] text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 gap-1"
                          onClick={() => openDomains(project)}>
                          <GlobeIcon className="w-3 h-3" />
                          <span className="hidden sm:inline">Domain</span>
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => { setDeleteProject(project); setDeleteConfirmName(""); }}>
                          <Trash2Icon className="w-3 h-3" />
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

      <Dialog open={createOpen} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <LayoutTemplateIcon className="w-3.5 h-3.5 text-orange-400" />
              Buat Pages Project
              <span className="ml-auto text-[11px] sm:text-xs text-gray-500 font-normal">Step {createStep}/3</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 text-[11px] sm:text-xs overflow-x-auto pb-1">
            {[
              { n: 1, label: "Pilih Repo" },
              { n: 2, label: "Build Config" },
              { n: 3, label: "Deploy" },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 shrink-0">
                <div className={cn(
                  "w-5.5 h-5.5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                  createStep > s.n ? "bg-green-500 text-white" :
                  createStep === s.n ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400"
                )}>
                  {createStep > s.n ? <CheckCircleIcon className="w-3.5 h-3.5" /> : s.n}
                </div>
                <span className={createStep === s.n ? "text-white" : "text-gray-500"}>{s.label}</span>
                {i < 2 && <ChevronRightIcon className="w-2.5 h-2.5 text-gray-600" />}
              </div>
            ))}
          </div>

          {createStep === 1 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm text-gray-300 font-medium">Pilih GitHub Repository</p>
                <Button size="sm" variant="ghost" className="text-[11px] sm:text-xs text-gray-500 hover:text-white h-7 px-2"
                  onClick={() => setUseManual(!useManual)}>
                  {useManual ? "Pilih dari daftar" : "Input manual"}
                </Button>
              </div>
              {useManual ? (
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-[11px] sm:text-xs">Owner/Repo (contoh: username/my-project)</Label>
                  <Input
                    placeholder="username/nama-repo"
                    value={manualRepo}
                    onChange={(e) => setManualRepo(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-sm h-9"
                  />
                </div>
              ) : reposLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                  <span className="text-gray-400 text-xs sm:text-sm">Memuat repo GitHub...</span>
                </div>
              ) : githubRepos.length > 0 ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Cari repo..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 text-sm h-9"
                  />
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {filteredRepos.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectRepo(r)}
                        className={cn(
                          "w-full text-left p-2.5 rounded-lg border transition-colors",
                          selectedRepo?.id === r.id
                            ? "bg-orange-500/15 border-orange-500/40 text-white"
                            : "bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-800 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderGitIcon className="w-4 h-4 shrink-0 text-gray-400" />
                          <span className="text-[13px] font-medium truncate">{r.full_name}</span>
                          {r.private && <Badge className="bg-gray-700 text-gray-400 text-[11px] shrink-0">Private</Badge>}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 ml-6 truncate">Branch: {r.default_branch}</p>
                      </button>
                    ))}
                    {filteredRepos.length === 0 && (
                      <p className="text-center text-gray-500 text-xs py-4">Tidak ada repo yang cocok</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                    Tidak bisa memuat daftar repo. Masukkan repo secara manual.
                  </p>
                  <Label className="text-gray-400 text-[11px] sm:text-xs">Owner/Repo</Label>
                  <Input
                    placeholder="username/nama-repo"
                    value={manualRepo}
                    onChange={(e) => setManualRepo(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-sm h-9"
                  />
                </div>
              )}
              {(selectedRepo || useManual) && (
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-[11px] sm:text-xs flex items-center gap-1"><GitBranchIcon className="w-3 h-3" /> Production Branch</Label>
                  <Input
                    placeholder="main"
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 text-sm h-9"
                  />
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  onClick={() => setCreateStep(2)}
                  disabled={!manualRepo && !selectedRepo}
                  className="bg-orange-500 hover:bg-orange-600 gap-1.5 h-8 px-3 text-xs"
                >
                  Lanjut <ChevronRightIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2.5 bg-gray-800/50 rounded-lg">
                <FolderGitIcon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-white font-medium truncate">
                    {useManual ? manualRepo : selectedRepo?.full_name}
                  </p>
                  <p className="text-[11px] sm:text-xs text-gray-500">Branch: {formBranch || "main"}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-[11px] sm:text-xs">Nama Project <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="my-website"
                  value={formProjectName}
                  onChange={(e) => setFormProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-sm h-9"
                />
                <p className="text-[11px] text-gray-600 break-words">Nama ini akan jadi subdomain: {formProjectName || "nama-project"}.pages.dev</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-[11px] sm:text-xs flex items-center gap-1"><TerminalIcon className="w-3 h-3" /> Build Command</Label>
                <Input
                  placeholder="npm run build"
                  value={formBuildCmd}
                  onChange={(e) => setFormBuildCmd(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-[11px] sm:text-xs flex items-center gap-1"><FolderIcon className="w-3 h-3" /> Output Directory</Label>
                <Input
                  placeholder="dist"
                  value={formOutputDir}
                  onChange={(e) => setFormOutputDir(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-[11px] sm:text-xs flex items-center gap-1"><FolderIcon className="w-3 h-3" /> Root Directory <span className="text-gray-600 font-normal">(opsional)</span></Label>
                <Input
                  placeholder="/"
                  value={formRootDir}
                  onChange={(e) => setFormRootDir(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 font-mono text-sm h-9"
                />
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="ghost" onClick={() => setCreateStep(1)} className="text-gray-400 gap-1.5 px-2 sm:px-3 h-8 text-xs">
                  <ChevronLeftIcon className="w-3.5 h-3.5" /> Kembali
                </Button>
                <Button
                  onClick={startCreateProject}
                  disabled={!canProceedStep2 || creating}
                  className="bg-orange-500 hover:bg-orange-600 gap-1.5 h-8 px-3 text-xs"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {creating ? "Membuat..." : "Buat & Deploy"}
                </Button>
              </div>
            </div>
          )}

          {createStep === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircleIcon className="w-4 h-4 text-green-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-white font-medium break-words">Project "{formProjectName}" berhasil dibuat!</p>
                  <a href={`https://${formProjectName}.pages.dev`} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] sm:text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5 truncate">
                    <ExternalLinkIcon className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{formProjectName}.pages.dev</span>
                  </a>
                </div>
              </div>
              {createdDeployment ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm text-gray-300 font-medium">Status Deployment</p>
                    {deployPollLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                  </div>
                  <div className="space-y-1.5">
                    {(createdDeployment.stages ?? STAGE_ORDER.map(n => ({ name: n, status: "pending" }))).map((stage) => {
                      const isActive = stage.status === "active" || stage.status === "running";
                      const isDone = stage.status === "success";
                      const isFailed = stage.status === "failure" || stage.status === "failed";
                      return (
                        <div key={stage.name} className={cn(
                          "flex items-center gap-2 p-2 rounded-lg",
                          isDone ? "bg-green-500/10" : isActive ? "bg-blue-500/10" : isFailed ? "bg-red-500/10" : "bg-gray-800/30"
                        )}>
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            {isDone ? <CheckCircleIcon className="w-3.5 h-3.5 text-green-400" /> :
                              isActive ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> :
                              isFailed ? <XCircleIcon className="w-3.5 h-3.5 text-red-400" /> :
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />}
                          </div>
                          <span className={cn("text-xs sm:text-sm", isDone ? "text-green-400" : isActive ? "text-blue-400" : isFailed ? "text-red-400" : "text-gray-500")}>
                            {STAGE_LABEL[stage.name] ?? stage.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {createdDeployment.url && (
                    <a href={createdDeployment.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 hover:text-blue-300 text-xs sm:text-sm">
                      <ExternalLinkIcon className="w-3.5 h-3.5 shrink-0" />
                      Buka preview deployment
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-xs sm:text-sm">Deployment akan segera dimulai...</p>
              )}
              <div className="flex justify-end">
                <Button onClick={closeCreate} className="bg-gray-700 hover:bg-gray-600 h-8 px-3 text-xs">
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!domainProject} onOpenChange={(o) => !o && setDomainProject(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <GlobeIcon className="w-3.5 h-3.5 text-orange-400" />
              Custom Domains — {domainProject?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400">
            Pilih domain yang tersedia di akunmu, ketik subdomain, lalu klik hubungkan untuk menghubungkan Pages project ini (Cloudflare otomatis membuat DNS & SSL).
          </p>

          <div className="bg-gray-800/60 p-3.5 rounded-lg border border-gray-700/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs text-gray-300 font-medium">Domain Tersedia</Label>
                <Select value={domainZoneId} onValueChange={setDomainZoneId}>
                  <SelectTrigger className="bg-gray-900 border-gray-700 text-white text-xs h-9">
                    <SelectValue placeholder="Pilih domain..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id} className="text-white hover:bg-gray-700 text-xs">
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-gray-300 font-medium">
                  Subdomain <span className="text-gray-500 font-normal">(kosongkan untuk root domain)</span>
                </Label>
                <Input
                  placeholder="misal: web atau app"
                  value={domainSubdomain}
                  onChange={(e) => setDomainSubdomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDomain()}
                  className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-xs h-9 font-mono"
                />
              </div>
            </div>

            {/* Target Hostname Preview & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-700/50">
              <div className="text-xs text-gray-400 truncate">
                Target Hostname:{" "}
                <span className="font-mono text-orange-400 font-semibold">
                  {(() => {
                    const curZone = zones.find((z) => z.id === domainZoneId) || zones[0];
                    if (!curZone) return "Belum ada domain di akun";
                    const sub = domainSubdomain.trim().toLowerCase();
                    if (!sub || sub === "@") return curZone.name;
                    return sub.endsWith(`.${curZone.name}`) ? sub : `${sub}.${curZone.name}`;
                  })()}
                </span>
              </div>
              <Button
                onClick={addDomain}
                disabled={addingDomain || (!domainZoneId && zones.length === 0)}
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 h-8 px-3 shrink-0"
              >
                {addingDomain ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlusIcon className="w-3.5 h-3.5" />
                )}
                Hubungkan Domain
              </Button>
            </div>
          </div>

          {/* List Connected Domains */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span>Custom Domain Terhubung ({domains.length})</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {domainsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : domains.length === 0 ? (
                <div className="text-center py-6 bg-gray-950/40 rounded-lg border border-gray-800">
                  <LinkIcon className="w-7 h-7 text-gray-600 mx-auto mb-1.5" />
                  <p className="text-gray-400 text-xs">Belum ada custom domain terhubung</p>
                  <p className="text-gray-600 text-[11px] mt-0.5">Pilih domain dan isi subdomain di atas untuk menambahkan</p>
                </div>
              ) : (
                domains.map((d) => (
                  <div key={d.name} className="flex items-center justify-between p-3 bg-gray-800/60 border border-gray-700/50 rounded-lg gap-3">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <GlobeIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white font-mono font-medium truncate">{d.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <DomainStatusBadge status={d.status} />
                          {d.created_on && (
                            <span className="text-[11px] text-gray-500">
                              {formatDate(d.created_on)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                      onClick={() => setDeleteDomain(d)}
                      title="Hapus domain"
                    >
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          {domainProject?.subdomain && (
            <div className="flex items-center gap-2 p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg overflow-hidden">
              <ExternalLinkIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <p className="text-xs text-blue-400 font-mono truncate">{domainProject.subdomain}.pages.dev</p>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] py-0 px-1.5 h-4 ml-auto shrink-0">Default pages.dev</Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deployProject} onOpenChange={(o) => !o && setDeployProject(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RocketIcon className="w-4 h-4 text-blue-400" />
              Deployments — {deployProject?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
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
