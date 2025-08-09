import { Link, useLocation } from "wouter";
import { User } from "@/lib/types";
import { TrendingUp, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalyticsHeaderProps {
  user: User;
}

export function AnalyticsHeader({ user }: AnalyticsHeaderProps) {
  const [location] = useLocation();
  
  // Only show for allowed roles
  const allowedRoles = ["Admin", "Sales", "WorkflowManager"];
  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button 
              variant={location === "/" ? "default" : "ghost"}
              size="sm"
              className="text-white"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link href="/team-progress">
            <Button 
              variant={location === "/team-progress" ? "default" : "ghost"}
              size="sm"
              className="text-white"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Team Progress
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}