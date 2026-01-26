import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import ShootTrackerSettings from "@/pages/shoottracker-settings";
import ApproveExtras from "@/pages/approve-extras";
import ClientChat from "@/pages/client-chat";
import EditorChat from "@/pages/editor-chat";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/shoottracker" component={ShootTrackerSettings} />
      <Route path="/approve-extras/:token" component={ApproveExtras} />
      <Route path="/client-chat/:token" component={ClientChat} />
      <Route path="/editor-chat" component={EditorChat} />
      <Route path="/settings" component={Settings} />
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
