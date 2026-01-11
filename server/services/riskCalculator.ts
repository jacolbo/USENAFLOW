import { Project, RiskLevel, RiskLevelType } from '@shared/schema';

interface RiskFactors {
  daysUntilDelivery: number;
  rolloverCount: number;
  isUnassigned: boolean;
  photosRemaining: number;
  workloadRatio: number; // photos per day needed
}

export function calculateRiskLevel(project: Project): RiskLevelType {
  const factors = getRiskFactors(project);
  
  // Critical: Overdue or due today with work remaining
  if (factors.daysUntilDelivery <= 0 && factors.photosRemaining > 0) {
    return RiskLevel.CRITICAL;
  }
  
  // Critical: Rolled over 3+ times
  if (factors.rolloverCount >= 3) {
    return RiskLevel.CRITICAL;
  }
  
  // High: Due within 2 days with significant work remaining
  if (factors.daysUntilDelivery <= 2 && factors.photosRemaining > 10) {
    return RiskLevel.HIGH;
  }
  
  // High: Rolled over 2 times
  if (factors.rolloverCount >= 2) {
    return RiskLevel.HIGH;
  }
  
  // High: Unassigned and due within 3 days
  if (factors.isUnassigned && factors.daysUntilDelivery <= 3) {
    return RiskLevel.HIGH;
  }
  
  // High: Workload ratio too high (more than 50 photos/day needed)
  if (factors.workloadRatio > 50 && factors.daysUntilDelivery > 0) {
    return RiskLevel.HIGH;
  }
  
  // Medium: Due within 5 days with work remaining
  if (factors.daysUntilDelivery <= 5 && factors.photosRemaining > 0) {
    return RiskLevel.MEDIUM;
  }
  
  // Medium: Rolled over once
  if (factors.rolloverCount >= 1) {
    return RiskLevel.MEDIUM;
  }
  
  // Medium: Unassigned and due within 7 days
  if (factors.isUnassigned && factors.daysUntilDelivery <= 7) {
    return RiskLevel.MEDIUM;
  }
  
  // Medium: Workload ratio is concerning (25-50 photos/day)
  if (factors.workloadRatio > 25 && factors.workloadRatio <= 50) {
    return RiskLevel.MEDIUM;
  }
  
  // Low: Everything else
  return RiskLevel.LOW;
}

function getRiskFactors(project: Project): RiskFactors {
  const now = new Date();
  const dueDate = project.deliveryDueDate || project.dueDate;
  const diffTime = new Date(dueDate).getTime() - now.getTime();
  const daysUntilDelivery = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const photosRemaining = project.toEditRemaining || (project.selectedCount - project.photosCompleted);
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
    case RiskLevel.CRITICAL:
      if (factors.daysUntilDelivery <= 0) {
        message = `OVERDUE! ${factors.photosRemaining} photos remaining`;
      } else if (factors.rolloverCount >= 3) {
        message = `Rolled over ${factors.rolloverCount} times - needs immediate attention`;
      }
      break;
      
    case RiskLevel.HIGH:
      if (factors.isUnassigned) {
        message = `Unassigned with ${factors.daysUntilDelivery} days until due`;
      } else if (factors.rolloverCount >= 2) {
        message = `Rolled over ${factors.rolloverCount} times`;
      } else {
        message = `${factors.daysUntilDelivery} days left, ${factors.photosRemaining} photos remaining`;
      }
      break;
      
    case RiskLevel.MEDIUM:
      if (factors.isUnassigned) {
        message = `Needs assignment - due in ${factors.daysUntilDelivery} days`;
      } else if (factors.rolloverCount >= 1) {
        message = `Previously rolled over - monitor closely`;
      } else {
        message = `${factors.daysUntilDelivery} days left for ${factors.photosRemaining} photos`;
      }
      break;
      
    case RiskLevel.LOW:
      message = 'On track';
      break;
  }
  
  return { level, factors, message };
}

export function getAtRiskProjects(projects: Project[], minLevel: RiskLevelType = RiskLevel.MEDIUM): Project[] {
  const riskPriority: Record<RiskLevelType, number> = {
    [RiskLevel.CRITICAL]: 4,
    [RiskLevel.HIGH]: 3,
    [RiskLevel.MEDIUM]: 2,
    [RiskLevel.LOW]: 1,
  };
  
  const minPriority = riskPriority[minLevel];
  
  return projects
    .filter(project => {
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
