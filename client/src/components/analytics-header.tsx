import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Home, LogOut } from "lucide-react";
import { Link } from "wouter";
import { User } from "@/lib/types";
import logoImage from "@assets/USENA-FLOW_1754522507856.png";

interface AnalyticsHeaderProps {
  user: User;
}

export function AnalyticsHeader({ user }: AnalyticsHeaderProps) {
  const handleLogout = () => {
    localStorage.removeItem('userSession');
    window.location.href = '/';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm mb-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <img 
                src={logoImage} 
                alt="USENA FLOW" 
                className="h-12 mr-2"
              />
              <span className="text-sm text-gray-600">by Jepson Myles Studio</span>
            </div>
            
            <nav className="flex items-center space-x-4">
              <Link href="/">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-gray-500">
                  {user.role === "LeadRetoucher" ? "Workflow Manager" : user.role}
                </span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}