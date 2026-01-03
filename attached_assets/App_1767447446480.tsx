import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface AuthSession {
  authenticated: boolean;
  user?: { id: string; username: string };
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  
  const { data: session, isLoading } = useQuery<AuthSession>({
    queryKey: ["/api/auth/session"],
    staleTime: 60000,
  });

  useEffect(() => {
    if (!isLoading && !session?.authenticated) {
      setLocation("/login");
    }
  }, [session, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.authenticated) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={Analytics} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
