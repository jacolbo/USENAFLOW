import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AiChatBubble from "@/components/ai-chat-bubble";
import Dashboard from "@/pages/dashboard";
import ShootTrackerSettings from "@/pages/shoottracker-settings";
import ApproveExtras from "@/pages/approve-extras";
import ClientChat from "@/pages/client-chat";
import EditorChat from "@/pages/editor-chat";
import SurveyPage from "@/pages/survey";
import ReferralPage from "@/pages/referral";
import UnsubscribePage from "@/pages/unsubscribe";
import LeaveManagement from "@/pages/leave-management";
import AiTeamChat from "@/pages/ai-team-chat";
import AutomationsPage from "@/pages/automations";
import AiBrainPage from "@/pages/ai-brain";
import GalleriesPage from "@/pages/galleries";
import GalleryDetailPage from "@/pages/gallery-detail";
import ClientGalleryPage from "@/pages/client-gallery";
import ShootBriefsPage from "@/pages/shoot-briefs";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/shoottracker" component={ShootTrackerSettings} />
      <Route path="/approve-extras/:token" component={ApproveExtras} />
      <Route path="/client-chat/:token" component={ClientChat} />
      <Route path="/editor-chat" component={EditorChat} />
      <Route path="/survey/:token" component={SurveyPage} />
      <Route path="/refer/:code" component={ReferralPage} />
      <Route path="/unsubscribe/:token" component={UnsubscribePage} />
      <Route path="/leave" component={LeaveManagement} />
      <Route path="/ai-chat" component={AiTeamChat} />
      <Route path="/automations" component={AutomationsPage} />
      <Route path="/ai-brain" component={AiBrainPage} />
      <Route path="/galleries" component={GalleriesPage} />
      <Route path="/galleries/:id" component={GalleryDetailPage} />
      <Route path="/g/:slug" component={ClientGalleryPage} />
      <Route path="/shoot-briefs" component={ShootBriefsPage} />
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
        <AiChatBubble />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
