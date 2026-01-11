import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

type RiskLevel = "SAFE" | "AT_RISK" | "OVERDUE";

interface RiskBadgeProps {
  level: RiskLevel | string | null | undefined;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

const riskConfig: Record<RiskLevel, {
  label: string;
  className: string;
  Icon: typeof AlertTriangle;
}> = {
  SAFE: {
    label: "Safe",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    Icon: CheckCircle,
  },
  AT_RISK: {
    label: "At Risk",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    Icon: AlertTriangle,
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    Icon: AlertCircle,
  },
};

export function RiskBadge({ 
  level, 
  showIcon = true, 
  showLabel = true,
  size = "md" 
}: RiskBadgeProps) {
  const normalizedLevel = level?.toUpperCase() as RiskLevel;
  const safeLevel = riskConfig[normalizedLevel] ? normalizedLevel : "SAFE";
  const config = riskConfig[safeLevel];
  const { label, className, Icon } = config;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1.5",
  };
  
  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <Badge 
      variant="outline" 
      className={`${className} ${sizeClasses[size]} inline-flex items-center gap-1 font-medium`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {showLabel && <span>{label}</span>}
    </Badge>
  );
}

export function RiskDot({ level }: { level: RiskLevel | string | null | undefined }) {
  const normalizedLevel = level?.toUpperCase() as RiskLevel;
  const safeLevel = riskConfig[normalizedLevel] ? normalizedLevel : "SAFE";
  
  const dotColors: Record<RiskLevel, string> = {
    SAFE: "bg-green-500",
    AT_RISK: "bg-yellow-500",
    OVERDUE: "bg-red-500",
  };
  
  return (
    <span 
      className={`inline-block w-2 h-2 rounded-full ${dotColors[safeLevel]}`}
      title={riskConfig[safeLevel]?.label || "Unknown"}
    />
  );
}
