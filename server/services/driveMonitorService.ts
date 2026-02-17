import { storage } from '../storage';
import { db } from '../db';
import { projects, aiTeamMessages } from '@shared/schema';
import { eq, isNotNull, isNull, and, not, inArray, sql } from 'drizzle-orm';
import * as driveService from './googleDriveService';
import { sendGalleryPreviewEmail, sendGalleryDeliveryEmail, sendSatisfactionSurveyEmail, generateToken } from './emailService';
import { recordFired, isEnabled } from './automationRegistry';

let monitorInterval: NodeJS.Timeout | null = null;
let scanInProgress = false;
const MONITOR_INTERVAL_MS = 2 * 60 * 1000; // Check every 2 minutes

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

  recordFired('bg_drive_monitor', `Scanning ${projectsWithFolders.length} folders`);
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

  const alreadyDelivered = project.status === 'Delivered' || project.status === 'Done' || project.driveDeliveryEmailSent;

  if (photosReady && !alreadyDelivered) {
    if (!project.driveGalleryLink && !updateData.driveGalleryLink) {
      try {
        const shareLink = await driveService.generateShareLink(project.driveFolderId);
        updateData.driveGalleryLink = shareLink;
        updateData.galleryLink = shareLink;
        updateData.galleryLinkAddedAt = new Date();
        updateData.galleryLinkAddedBy = 'Drive Auto-Detection';
        console.log(`🔗 Drive Monitor: Gallery link generated for ${project.clientName}`);
      } catch (err: any) {
        console.error(`📂 Drive Monitor: Failed to generate share link for ${project.clientName}: ${err.message}`);
      }
    }

    const photoCountChanged = result.drivePhotoCount !== project.drivePhotoCount;
    const qualityGateFailed = project.qualityGatePassed === false && !project.qualityGateOverride;
    if (photoCountChanged && qualityGateFailed) {
      console.log(`🔄 Drive Monitor: Photo count changed for ${project.clientName} (${project.drivePhotoCount} → ${result.drivePhotoCount}) and quality gate previously failed — resetting for re-check`);
      updateData.qualityGatePassed = null;
      updateData.qualityGateScore = null;
      updateData.qualityGateAt = null;
      updateData.qualityGateFeedback = null;
    }

    if (!project.drivePreviewEmailSent && isEnabled('dm_preview_email')) {
      const [freshProject] = await db.select({ drivePreviewEmailSent: projects.drivePreviewEmailSent }).from(projects).where(eq(projects.id, project.id));
      if (freshProject && !freshProject.drivePreviewEmailSent) {
        const galleryLink = updateData.driveGalleryLink || project.driveGalleryLink || project.galleryLink;
        if (galleryLink && project.clientEmail) {
          await db.update(projects).set({ drivePreviewEmailSent: true, drivePreviewEmailSentAt: new Date() }).where(eq(projects.id, project.id));
          try {
            await sendGalleryPreviewEmail(
              project.clientEmail,
              project.clientName,
              galleryLink,
              project.id
            );
            updateData.drivePreviewEmailSent = true;
            updateData.drivePreviewEmailSentAt = new Date();
            recordFired('dm_preview_email', `Preview email sent to ${project.clientName}`);
            console.log(`📧 Drive Monitor: Preview email (no access) sent to ${project.clientEmail} for ${project.clientName}`);
          } catch (err: any) {
            await db.update(projects).set({ drivePreviewEmailSent: false, drivePreviewEmailSentAt: null }).where(eq(projects.id, project.id));
            console.error(`📂 Drive Monitor: Failed to send preview email for ${project.clientName}: ${err.message} — flag reset for retry`);
          }
        }
      }
    }

    const currentQualityPassed = updateData.qualityGatePassed !== undefined ? updateData.qualityGatePassed : project.qualityGatePassed;
    const hasQualityGateResult = currentQualityPassed !== null && currentQualityPassed !== undefined;

    if (!hasQualityGateResult) {
      console.log(`🔍 Drive Monitor: ${project.clientName} photos complete (${result.drivePhotoCount}/${project.selectedCount}) — running quality gate for feedback...`);
      try {
        await runAutomaticQualityGate(project, updateData);
      } catch (err: any) {
        console.error(`📂 Drive Monitor: Quality gate check failed for ${project.clientName}: ${err.message}`);
      }
    }
  }

  if (photosReady && !alreadyDelivered && project.drivePreviewEmailSent && !project.driveDeliveryEmailSent && isEnabled('dm_detect_public')) {
    try {
      const isPublic = await driveService.checkFolderIsPublicLink(project.driveFolderId);
      if (isPublic) {
        recordFired('dm_detect_public', `Public folder detected for ${project.clientName}`);
        console.log(`🔓 Drive Monitor: Folder for ${project.clientName} is now public — triggering delivery`);
        await executeDeliveryOnPublic(project, updateData, result);
      }
    } catch (err: any) {
      console.error(`📂 Drive Monitor: Failed to check public status for ${project.clientName}: ${err.message}`);
    }
  }

  if (project.status === 'Delivered' || project.status === 'Done') {
    if (!project.driveAccessGranted) {
      updateData.driveAccessGranted = true;
      console.log(`📂 Drive Monitor: Auto-marking ${project.clientName} as access-granted (already ${project.status})`);
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

async function runAutomaticQualityGate(project: any, updateData: any) {
  const qualitySettings = await storage.getAppSetting("quality_gate_settings") as any;
  const threshold = qualitySettings?.threshold ?? 7;

  const { getImageThumbnails } = await import('./googleDriveService');
  const images = await getImageThumbnails(project.driveFolderId, 6);

  const photos = images
    .filter((img: any) => img.thumbnailLink)
    .map((img: any) => ({
      name: img.name,
      thumbnailUrl: img.thumbnailLink!,
    }));

  if (photos.length === 0) {
    console.log(`📂 Drive Monitor: No thumbnails available for quality check on ${project.clientName} — skipping`);
    return;
  }

  let referenceUrls: string[] = [];
  try {
    const refSetting = await storage.getAppSetting("quality_reference_images") as any;
    if (refSetting && Array.isArray(refSetting)) {
      referenceUrls = refSetting;
    }
  } catch (e) {}

  const { evaluateQualityGate } = await import('./aiService');
  const result = await evaluateQualityGate({
    projectName: project.clientName,
    photos,
    threshold,
    referenceImageUrls: referenceUrls.length > 0 ? referenceUrls : undefined,
  });

  updateData.qualityGateScore = result.overallScore;
  updateData.qualityGatePassed = result.passed;
  updateData.qualityGateAt = new Date();
  updateData.qualityGateFeedback = result;

  if (result.passed) {
    console.log(`✅ Drive Monitor: Quality gate PASSED for ${project.clientName} (score: ${result.overallScore}/${threshold}) — awaiting manual release`);
  } else {
    console.log(`❌ Drive Monitor: Quality gate FAILED for ${project.clientName} (score: ${result.overallScore}/${threshold}) — notifying retoucher`);
    await notifyRetoucherQualityFailed(project, result);
  }
}

async function notifyRetoucherQualityFailed(project: any, qualityResult: any) {
  const retoucherName = project.assignedTo;
  if (!retoucherName) {
    console.log(`📂 Drive Monitor: No retoucher assigned to ${project.clientName} — cannot notify about quality failure`);
    return;
  }

  let aiMessage = `Hi ${retoucherName}, the automated quality check for "${project.clientName}" did not pass (score: ${qualityResult.overallScore}/10). `;
  if (qualityResult.feedback && qualityResult.feedback.length > 0) {
    aiMessage += `Here's what needs attention:\n`;
    qualityResult.feedback.forEach((f: string, i: number) => {
      aiMessage += `${i + 1}. ${f}\n`;
    });
  }
  if (qualityResult.recommendation) {
    aiMessage += `\nRecommendation: ${qualityResult.recommendation}`;
  }
  aiMessage += `\n\nPlease make the necessary corrections and re-upload. The system will automatically re-check once updated photos are detected.`;

  try {
    const OpenAI = require("openai").default;
    const openai = new OpenAI();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are the studio manager AI at Jepson Myles Studio. Rewrite the following quality feedback message for the retoucher in a professional, supportive but clear tone. Keep all specific feedback points and the recommendation. Address them by name. Do not add markdown formatting."
        },
        { role: "user", content: aiMessage }
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const polishedMessage = response.choices[0]?.message?.content?.trim() || aiMessage;

    await db.insert(aiTeamMessages).values({
      username: retoucherName,
      role: 'system',
      message: polishedMessage,
      senderType: 'ai',
      metadata: { type: 'quality_gate_failed', projectId: project.id, score: qualityResult.overallScore },
    });

    console.log(`🤖 Drive Monitor: AI quality feedback sent to ${retoucherName} for ${project.clientName}`);
  } catch (err: any) {
    console.error(`📂 Drive Monitor: Failed to send AI quality message to ${retoucherName}: ${err.message}`);
    try {
      await db.insert(aiTeamMessages).values({
        username: retoucherName,
        role: 'system',
        message: aiMessage,
        senderType: 'ai',
        metadata: { type: 'quality_gate_failed', projectId: project.id, score: qualityResult.overallScore },
      });
    } catch (e) {}
  }
}

async function executeDeliveryOnPublic(project: any, updateData: any, result: DriveMonitorResult) {
  const galleryLink = updateData.driveGalleryLink || project.driveGalleryLink || project.galleryLink;

  if (!galleryLink) {
    console.log(`📂 Drive Monitor: No gallery link for ${project.clientName} — cannot deliver`);
    return;
  }

  updateData.driveAccessGranted = true;
  updateData.driveAccessGrantedAt = new Date();
  updateData.driveDeliveryComplete = true;
  updateData.driveDeliveryCompletedAt = new Date();
  updateData.status = 'Delivered';
  updateData.deliveredAt = new Date();
  updateData.deliveryApproved = true;
  updateData.deliveryApprovedAt = new Date();
  updateData.deliveryApprovedBy = 'Drive Auto-Detection';
  result.deliveryTriggered = true;

  if (project.clientEmail) {
    let referralCode: string | undefined;
    try {
      referralCode = generateToken();
      await storage.createReferral({
        referrerEmail: project.clientEmail,
        referrerName: project.clientName,
        referralCode,
        status: "pending",
      });
    } catch (refError) {
      console.error(`[Referral] Error creating referral for ${project.clientName}:`, refError);
    }

    try {
      await db.update(projects).set({ driveDeliveryEmailSent: true, driveDeliveryEmailSentAt: new Date(), deliveryEmailSentAt: new Date() }).where(eq(projects.id, project.id));

      const emailResult = await sendGalleryDeliveryEmail(
        project.clientEmail,
        project.clientName,
        galleryLink,
        project.id,
        referralCode
      );
      if (emailResult.success) {
        updateData.driveDeliveryEmailSent = true;
        updateData.driveDeliveryEmailSentAt = new Date();
        updateData.deliveryEmailSentAt = new Date();
        recordFired('dm_delivery_email', `Delivery email sent to ${project.clientName}`);
        console.log(`📧 Drive Monitor: Delivery email (with access) sent to ${project.clientEmail} for ${project.clientName}`);
      } else {
        await db.update(projects).set({ driveDeliveryEmailSent: false, driveDeliveryEmailSentAt: null }).where(eq(projects.id, project.id));
        console.error(`📂 Drive Monitor: Delivery email failed for ${project.clientName} — flag reset for retry`);
      }
    } catch (emailError) {
      await db.update(projects).set({ driveDeliveryEmailSent: false, driveDeliveryEmailSentAt: null }).where(eq(projects.id, project.id));
      console.error(`[Email] Error sending delivery email for ${project.clientName}:`, emailError);
    }

    try {
      const surveyToken = generateToken();
      await storage.createSurvey({
        projectId: project.id,
        clientEmail: project.clientEmail,
        clientName: project.clientName,
        surveyToken,
      });
      await sendSatisfactionSurveyEmail(
        project.clientEmail,
        project.clientName,
        surveyToken,
        project.id
      );
      console.log(`📧 Drive Monitor: Survey sent to ${project.clientEmail} for ${project.clientName}`);
    } catch (surveyError) {
      console.error(`[Survey] Error creating survey for ${project.clientName}:`, surveyError);
    }
  }

  try {
    await storage.recordStatusTransition(project.id, project.status || 'Review', 'Delivered', 'Drive Auto-Detection');
  } catch (e) {}

  console.log(`✅ Drive Monitor: Full delivery completed for ${project.clientName}`);
}

export function startDriveMonitor() {
  if (monitorInterval) {
    console.log('📂 Drive Monitor already running');
    return;
  }

  console.log(`📂 Drive Monitor started (checking every ${MONITOR_INTERVAL_MS / 1000}s)`);

  monitorInterval = setInterval(async () => {
    if (!isEnabled('bg_drive_monitor')) {
      return;
    }
    if (scanInProgress) {
      console.log('📂 Drive Monitor: Previous scan still running, skipping this cycle');
      return;
    }
    try {
      scanInProgress = true;
      await scanAllProjectFolders();
    } catch (error: any) {
      console.error(`📂 Drive Monitor error: ${error.message}`);
    } finally {
      scanInProgress = false;
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
