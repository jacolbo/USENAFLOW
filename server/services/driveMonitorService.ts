import { storage } from '../storage';
import { db } from '../db';
import { projects } from '@shared/schema';
import { eq, isNotNull, and, sql } from 'drizzle-orm';
import * as driveService from './googleDriveService';
import { sendGalleryDeliveryEmail, sendSneakPeekEmail } from './emailService';

let monitorInterval: NodeJS.Timeout | null = null;
const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

export interface DriveMonitorResult {
  projectId: string;
  clientName: string;
  selectedCount: number;
  drivePhotoCount: number;
  driveBwPhotoCount: number;
  driveStorageBytes: number;
  status: 'incomplete' | 'complete' | 'over' | 'no_folder';
  deliveryTriggered: boolean;
  bwEmailTriggered: boolean;
}

export async function scanAllProjectFolders(): Promise<DriveMonitorResult[]> {
  const results: DriveMonitorResult[] = [];

  const projectsWithFolders = await db
    .select()
    .from(projects)
    .where(isNotNull(projects.driveFolderId));

  console.log(`📂 Drive Monitor: Scanning ${projectsWithFolders.length} project folders...`);

  for (const project of projectsWithFolders) {
    try {
      const result = await scanProjectFolder(project);
      results.push(result);
    } catch (error: any) {
      console.error(`📂 Drive Monitor: Error scanning ${project.clientName}: ${error.message}`);
      results.push({
        projectId: project.id,
        clientName: project.clientName,
        selectedCount: project.selectedCount,
        drivePhotoCount: project.drivePhotoCount,
        driveBwPhotoCount: project.driveBwPhotoCount || 0,
        driveStorageBytes: project.driveStorageBytes,
        status: 'no_folder',
        deliveryTriggered: false,
        bwEmailTriggered: false,
      });
    }
  }

  return results;
}

export async function scanProjectFolder(project: any): Promise<DriveMonitorResult> {
  const result: DriveMonitorResult = {
    projectId: project.id,
    clientName: project.clientName,
    selectedCount: project.selectedCount,
    drivePhotoCount: 0,
    driveBwPhotoCount: 0,
    driveStorageBytes: 0,
    status: 'no_folder',
    deliveryTriggered: false,
    bwEmailTriggered: false,
  };

  if (!project.driveFolderId) {
    return result;
  }

  const mainStats = await driveService.countImagesInFolder(project.driveFolderId);
  result.drivePhotoCount = mainStats.imageCount;
  result.driveStorageBytes = mainStats.totalSizeBytes;

  if (project.driveBwFolderId) {
    const bwStats = await driveService.countImagesInFolder(project.driveBwFolderId);
    result.driveBwPhotoCount = bwStats.imageCount;
    result.driveStorageBytes += bwStats.totalSizeBytes;
  }

  const updateData: any = {
    drivePhotoCount: result.drivePhotoCount,
    driveBwPhotoCount: result.driveBwPhotoCount,
    driveStorageBytes: result.driveStorageBytes,
    driveLastCheckedAt: new Date(),
  };

  if (result.drivePhotoCount >= project.selectedCount) {
    result.status = result.drivePhotoCount > project.selectedCount ? 'over' : 'complete';
  } else {
    result.status = 'incomplete';
  }

  const photosReady = project.selectedCount > 0 && result.drivePhotoCount >= project.selectedCount;

  if (photosReady && !project.driveGalleryLink && !updateData.driveGalleryLink) {
    console.log(`✅ Drive Monitor: ${project.clientName} photos complete! (${result.drivePhotoCount}/${project.selectedCount}) — generating gallery link`);
    try {
      const shareLink = await driveService.generateShareLink(project.driveFolderId);
      updateData.driveGalleryLink = shareLink;
      updateData.galleryLink = shareLink;
      updateData.galleryLinkAddedAt = new Date();
      updateData.galleryLinkAddedBy = 'Drive Auto-Detection';
      console.log(`🔗 Drive Monitor: Gallery link saved for ${project.clientName} (folder stays private)`);
    } catch (err: any) {
      console.error(`📂 Drive Monitor: Failed to generate share link for ${project.clientName}: ${err.message} — will retry next scan`);
    }
  }

  if (project.status === 'Delivered' || project.status === 'Done') {
    if (!project.driveAccessGranted) {
      updateData.driveAccessGranted = true;
      console.log(`📂 Drive Monitor: Auto-marking ${project.clientName} as access-granted (already ${project.status})`);
    }
  }

  const galleryLink = project.driveGalleryLink || updateData.driveGalleryLink;
  const alreadyDelivered = project.status === 'Delivered' || project.status === 'Done' || project.driveDeliveryEmailSent;

  if (photosReady && galleryLink && project.clientEmail && project.driveFolderId && !project.driveAccessGranted && !alreadyDelivered) {
    try {
      const hasAccess = await driveService.checkClientHasAccess(project.driveFolderId, project.clientEmail);
      if (hasAccess) {
        console.log(`🔓 Drive Monitor: Access granted detected for ${project.clientName} (${project.clientEmail})`);

        updateData.driveAccessGranted = true;
        updateData.driveAccessGrantedAt = new Date();
        updateData.driveDeliveryComplete = true;
        updateData.driveDeliveryCompletedAt = new Date();
        updateData.status = 'Delivered';
        updateData.deliveredAt = new Date();
        result.deliveryTriggered = true;

        try {
          const { sendGalleryDeliveryEmail } = await import('./emailService');
          await sendGalleryDeliveryEmail(
            project.clientEmail,
            project.clientName,
            galleryLink,
            project.id
          );
          updateData.driveDeliveryEmailSent = true;
          updateData.driveDeliveryEmailSentAt = new Date();
          updateData.deliveryEmailSentAt = new Date();
          console.log(`📧 Drive Monitor: Sent delivery email to ${project.clientEmail} for ${project.clientName} (access granted trigger)`);
        } catch (err: any) {
          console.error(`📂 Drive Monitor: Failed to send delivery email for ${project.clientName}: ${err.message}`);
        }
      }
    } catch (err: any) {
      console.error(`📂 Drive Monitor: Failed to check permissions for ${project.clientName}: ${err.message}`);
    }
  }

  // B&W preview email disabled — client access is not granted.
  // Admin must manually enable sharing and send preview when ready.
  if (result.driveBwPhotoCount > 0 && !project.driveBwSent) {
    updateData.driveBwSent = true;
    updateData.driveBwSentAt = new Date();
    result.bwEmailTriggered = false;
    console.log(`📂 Drive Monitor: B&W photos detected for ${project.clientName} (${result.driveBwPhotoCount}) — email not sent (access disabled)`);
  }

  await db.update(projects).set(updateData).where(eq(projects.id, project.id));

  return result;
}

export function startDriveMonitor() {
  if (monitorInterval) {
    console.log('📂 Drive Monitor already running');
    return;
  }

  console.log(`📂 Drive Monitor started (checking every ${MONITOR_INTERVAL_MS / 1000}s)`);

  monitorInterval = setInterval(async () => {
    try {
      await scanAllProjectFolders();
    } catch (error: any) {
      console.error(`📂 Drive Monitor error: ${error.message}`);
    }
  }, MONITOR_INTERVAL_MS);
}

export function stopDriveMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('📂 Drive Monitor stopped');
  }
}

export async function createDriveFolderForProject(projectId: string, parentFolderId?: string): Promise<{ mainFolderId: string; bwFolderId: string; folderName: string } | null> {
  const project = await storage.getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  if (project.driveFolderId) {
    const exists = await driveService.checkFolderExists(project.driveFolderId);
    if (exists) {
      console.log(`📂 Project ${project.clientName} already has a Drive folder`);
      return {
        mainFolderId: project.driveFolderId,
        bwFolderId: project.driveBwFolderId || '',
        folderName: project.driveFolderName || '',
      };
    }
  }

  const { mainFolder, bwFolder } = await driveService.createProjectFolderStructure(
    project.clientName,
    project.selectedCount,
    parentFolderId
  );

  await db.update(projects).set({
    driveFolderId: mainFolder.id,
    driveFolderName: mainFolder.name,
    driveBwFolderId: bwFolder.id,
  }).where(eq(projects.id, projectId));

  return {
    mainFolderId: mainFolder.id,
    bwFolderId: bwFolder.id,
    folderName: mainFolder.name,
  };
}
