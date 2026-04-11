import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import OverviewPage from "@/pages/OverviewPage";
import ZonesPage from "@/pages/ZonesPage";
import DNSPage from "@/pages/DNSPage";
import EmailRoutingPage from "@/pages/EmailRoutingPage";
import WorkersPage from "@/pages/WorkersPage";
import FirewallPage from "@/pages/FirewallPage";
import SSLPage from "@/pages/SSLPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import CachePage from "@/pages/CachePage";
import PageRulesPage from "@/pages/PageRulesPage";
import PagesPage from "@/pages/PagesPage";
import SettingsPage from "@/pages/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-64">
      <p className="text-4xl font-bold text-gray-600 mb-2">404</p>
      <p className="text-gray-400">Halaman tidak ditemukan</p>
    </div>
  );
}

function AppRoutes() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) return <LoginPage />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/zones" component={ZonesPage} />
        <Route path="/dns" component={DNSPage} />
        <Route path="/email" component={EmailRoutingPage} />
        <Route path="/workers" component={WorkersPage} />
        <Route path="/pages" component={PagesPage} />
        <Route path="/page-rules" component={PageRulesPage} />
        <Route path="/firewall" component={FirewallPage} />
        <Route path="/ssl" component={SSLPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/cache" component={CachePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
