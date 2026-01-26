import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Calendar, 
  MessageCircle, 
  Settings,
  ChevronDown,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  currentUser?: {
    name: string;
    role: string;
    abbreviation?: string;
  } | null;
  onLogout?: () => void;
  unreadChatCount?: number;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
  showBadge?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "ShootTracker", href: "/shoottracker", icon: Calendar, roles: ["Admin", "LeadRetoucher"] },
  { label: "Editor Chat", href: "/editor-chat", icon: MessageCircle, roles: ["Admin", "LeadRetoucher", "Retoucher1", "Retoucher2", "Retoucher3", "Evans"], showBadge: true },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["Admin", "LeadRetoucher"] },
];

export function AppLayout({ children, currentUser, onLogout, unreadChatCount = 0 }: AppLayoutProps) {
  const [location] = useLocation();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    if (!currentUser) return false;
    return item.roles.includes(currentUser.role);
  });

  const userInitial = currentUser?.name?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-[240px] flex flex-col sidebar border-r border-sidebar-border shrink-0">
        {/* Workspace selector */}
        <div className="p-3 border-b border-sidebar-border">
          <button 
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
              J
            </div>
            <span className="text-sm font-medium text-white truncate flex-1 text-left">
              Jepson Myles Studio
            </span>
            <ChevronDown className="w-4 h-4 text-sidebar-foreground" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location === item.href;
            const showBadgeCount = item.showBadge && unreadChatCount > 0;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn("sidebar-item cursor-pointer", isActive && "active")}>
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                  {showBadgeCount && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {unreadChatCount > 99 ? "99+" : unreadChatCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        {currentUser && (
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                <p className="text-xs text-sidebar-foreground truncate">{currentUser.role}</p>
              </div>
              {onLogout && (
                <button 
                  onClick={onLogout}
                  className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4 text-sidebar-foreground" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: { label: string; value: string; }[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
}

export function PageHeader({ title, description, actions, tabs, activeTab, onTabChange }: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-background sticky top-0 z-10">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
        {tabs && tabs.length > 0 && (
          <div className="flex gap-1 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={cn(
                  "tab-pill",
                  activeTab === tab.value && "active"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsRowProps {
  stats: { label: string; value: string | number; }[];
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="stats-row px-6 py-4 border-b border-border">
      {stats.map((stat, index) => (
        <div key={index} className="stat-item">
          <span className="stat-label">{stat.label}</span>
          <span className="stat-value">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: typeof LayoutDashboard;
}

export function EmptyState({ title, description, action, icon: Icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
}
