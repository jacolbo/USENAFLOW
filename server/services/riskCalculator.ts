import { Project, RiskLevel, RiskLevelType, ProjectStatus } from '@shared/schema';

interface RiskFactors {
  daysUntilDelivery: number;
  rolloverCount: number;
  isUnassigned: boolean;
  photosRemaining: number;
  workloadRatio: number; // photos per day needed
}

export function calculateRiskLevel(project: Partial<Project> & { deliveryDueDate?: Date | null }): RiskLevelType {
  const factors = getRiskFactors(project);
  
  // OVERDUE: Past due date with work remaining
  if (factors.daysUntilDelivery < 0 && factors.photosRemaining > 0) {
    return RiskLevel.OVERDUE;
  }
  
  // OVERDUE: Rolled over 3+ times
  if (factors.rolloverCount >= 3) {
    return RiskLevel.OVERDUE;
  }
  
  // AT_RISK: Due within 3 days with work remaining
  if (factors.daysUntilDelivery <= 3 && factors.photosRemaining > 0) {
    return RiskLevel.AT_RISK;
  }
  
  // AT_RISK: Rolled over 2+ times
  if (factors.rolloverCount >= 2) {
    return RiskLevel.AT_RISK;
  }
  
  // AT_RISK: Unassigned and due within 5 days
  if (factors.isUnassigned && factors.daysUntilDelivery <= 5 && factors.daysUntilDelivery >= 0) {
    return RiskLevel.AT_RISK;
  }
  
  // AT_RISK: Workload ratio too high (more than 50 photos/day needed)
  if (factors.workloadRatio > 50 && factors.daysUntilDelivery > 0) {
    return RiskLevel.AT_RISK;
  }
  
  // AT_RISK: Rolled over once
  if (factors.rolloverCount >= 1) {
    return RiskLevel.AT_RISK;
  }
  
  // SAFE: Everything else
  return RiskLevel.SAFE;
}

function getRiskFactors(project: Partial<Project> & { deliveryDueDate?: Date | null }): RiskFactors {
  const now = new Date();
  const dueDate = project.deliveryDueDate || project.dueDate;
  
  if (!dueDate) {
    return {
      daysUntilDelivery: 30, // Default to safe if no due date
      rolloverCount: 0,
      isUnassigned: true,
      photosRemaining: 0,
      workloadRatio: 0,
    };
  }
  
  const diffTime = new Date(dueDate).getTime() - now.getTime();
  const daysUntilDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const photosRemaining = project.toEditRemaining || 
    ((project.selectedCount || 0) - (project.photosCompleted || 0));
  const workloadRatio = daysUntilDelivery > 0 
    ? photosRemaining / daysUntilDelivery 
    : photosRemaining;
  
  return {
    daysUntilDelivery,
    rolloverCount: project.rolloverCount || 0,
    isUnassigned: !project.assignedTo || project.assignedTo === '__UNASSIGN__',
    photosRemaining: Math.max(0, photosRemaining),
    workloadRatio,
  };
}

export function getRiskDetails(project: Project): {
  level: RiskLevelType;
  factors: RiskFactors;
  message: string;
} {
  const factors = getRiskFactors(project);
  const level = calculateRiskLevel(project);
  
  let message = '';
  
  switch (level) {
    case RiskLevel.OVERDUE:
      if (factors.daysUntilDelivery < 0) {
        message = `OVERDUE by ${Math.abs(factors.daysUntilDelivery)} days! ${factors.photosRemaining} photos remaining`;
      } else if (factors.rolloverCount >= 3) {
        message = `Rolled over ${factors.rolloverCount} times - critical attention needed`;
      }
      break;
      
    case RiskLevel.AT_RISK:
      if (factors.isUnassigned) {
        message = `Unassigned with ${factors.daysUntilDelivery} days until due`;
      } else if (factors.rolloverCount >= 1) {
        message = `Rolled over ${factors.rolloverCount} time(s) - monitor closely`;
      } else {
        message = `${factors.daysUntilDelivery} days left, ${factors.photosRemaining} photos remaining`;
      }
      break;
      
    case RiskLevel.SAFE:
      message = 'On track';
      break;
  }
  
  return { level, factors, message };
}

export function getAtRiskProjects(projects: Project[], minLevel: RiskLevelType = RiskLevel.AT_RISK): Project[] {
  const riskPriority: Record<RiskLevelType, number> = {
    [RiskLevel.OVERDUE]: 3,
    [RiskLevel.AT_RISK]: 2,
    [RiskLevel.SAFE]: 1,
  };
  
  const minPriority = riskPriority[minLevel];
  
  return projects
    .filter(project => {
      // Skip delivered/done projects
      if (project.status === ProjectStatus.DELIVERED || project.status === ProjectStatus.DONE) {
        return false;
      }
      const level = calculateRiskLevel(project);
      return riskPriority[level] >= minPriority;
    })
    .sort((a, b) => {
      const levelA = calculateRiskLevel(a);
      const levelB = calculateRiskLevel(b);
      return riskPriority[levelB] - riskPriority[levelA];
    });
}

export function updateProjectRiskLevels(projects: Project[]): Array<{ id: string; riskLevel: RiskLevelType }> {
  return projects.map(project => ({
    id: project.id,
    riskLevel: calculateRiskLevel(project),
  }));
}
