import { google } from 'googleapis';

// Google Drive integration - uses Replit Connectors (connection:conn_google-drive_01KH163DZ5EYZJ1MMNJ6VDCHY8)
let driveConnectionSettings: any;

async function getDriveAccessToken() {
  if (driveConnectionSettings && driveConnectionSettings.settings?.expires_at && new Date(driveConnectionSettings.settings.expires_at).getTime() > Date.now()) {
    return driveConnectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const url = 'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-drive';

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  driveConnectionSettings = data.items?.[0];

  const accessToken = driveConnectionSettings?.settings?.access_token || driveConnectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!driveConnectionSettings || !accessToken) {
    throw new Error('Google Drive not connected');
  }

  return accessToken;
}

async function getDriveClient() {
  const accessToken = await getDriveAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

const IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/raw',
  'image/x-raw',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-sony-arw',
  'image/x-adobe-dng',
];

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  webViewLink: string;
  thumbnailLink?: string;
}

export interface DriveFolderStats {
  totalFiles: number;
  imageCount: number;
  totalSizeBytes: number;
  files: DriveFileInfo[];
}

export async function createFolder(name: string, parentFolderId?: string): Promise<DriveFolder> {
  const drive = await getDriveClient();

  const fileMetadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentFolderId) {
    fileMetadata.parents = [parentFolderId];
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, name, webViewLink',
  });

  console.log(`📁 Created Drive folder: ${name} (${response.data.id})`);
  return {
    id: response.data.id!,
    name: response.data.name!,
    webViewLink: response.data.webViewLink!,
  };
}

export async function listFilesInFolder(folderId: string): Promise<DriveFileInfo[]> {
  const drive = await getDriveClient();
  const allFiles: DriveFileInfo[] = [];
  let pageToken: string | undefined;

  do {
    const response: any = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)',
      pageSize: 1000,
      pageToken,
    });

    for (const file of response.data.files || []) {
      allFiles.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: parseInt(file.size || '0', 10),
        createdTime: file.createdTime!,
        webViewLink: file.webViewLink || '',
        thumbnailLink: file.thumbnailLink || undefined,
      });
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

export async function countImagesInFolder(folderId: string): Promise<{ imageCount: number; totalFiles: number; totalSizeBytes: number }> {
  const files = await listFilesInFolder(folderId);

  const imageFiles = files.filter(f => {
    const mime = f.mimeType.toLowerCase();
    return IMAGE_MIMETYPES.some(im => mime.startsWith(im.split('/')[0] + '/' + im.split('/')[1])) || mime.startsWith('image/');
  });

  const totalSizeBytes = files.reduce((sum, f) => sum + f.size, 0);

  return {
    imageCount: imageFiles.length,
    totalFiles: files.length,
    totalSizeBytes,
  };
}

export async function getFolderStats(folderId: string): Promise<DriveFolderStats> {
  const files = await listFilesInFolder(folderId);

  const imageCount = files.filter(f => f.mimeType.startsWith('image/')).length;
  const totalSizeBytes = files.reduce((sum, f) => sum + f.size, 0);

  return {
    totalFiles: files.length,
    imageCount,
    totalSizeBytes,
    files,
  };
}

export async function generateShareLink(folderId: string): Promise<string> {
  const drive = await getDriveClient();

  const file = await drive.files.get({
    fileId: folderId,
    fields: 'webViewLink',
  });

  console.log(`🔗 Generated link for folder ${folderId}: ${file.data.webViewLink} (no access granted — folder stays private)`);
  return file.data.webViewLink!;
}

export async function checkFolderIsPublicLink(folderId: string): Promise<boolean> {
  try {
    const drive = await getDriveClient();
    const permissions = await drive.permissions.list({
      fileId: folderId,
      fields: 'permissions(id, role, type)',
    });

    const anyonePermission = permissions.data.permissions?.find(
      (p) => p.type === 'anyone'
    );

    return !!anyonePermission;
  } catch (error: any) {
    console.error(`🔒 Drive: Failed to check permissions for folder ${folderId}: ${error.message}`);
    return false;
  }
}

export async function makeFolderPublic(folderId: string): Promise<string> {
  const drive = await getDriveClient();

  const alreadyPublic = await checkFolderIsPublicLink(folderId);
  if (!alreadyPublic) {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    console.log(`🔓 Drive: Made folder ${folderId} public (Anyone with the link)`);
  }

  const file = await drive.files.get({
    fileId: folderId,
    fields: 'webViewLink',
  });

  return file.data.webViewLink!;
}

export async function getFolderSize(folderId: string): Promise<number> {
  const files = await listFilesInFolder(folderId);
  return files.reduce((sum, f) => sum + f.size, 0);
}

export async function getFileViewActivity(fileId: string): Promise<{ lastViewedByMeTime?: string; viewedByMeTime?: string }> {
  const drive = await getDriveClient();

  const file = await drive.files.get({
    fileId,
    fields: 'lastModifyingUser, viewedByMe, viewedByMeTime, sharedWithMeTime',
  });

  return {
    lastViewedByMeTime: file.data.viewedByMeTime || undefined,
    viewedByMeTime: file.data.viewedByMeTime || undefined,
  };
}

export async function checkFolderExists(folderId: string): Promise<boolean> {
  try {
    const drive = await getDriveClient();
    await drive.files.get({ fileId: folderId, fields: 'id' });
    return true;
  } catch {
    return false;
  }
}

export async function findFolderByName(name: string, parentFolderId?: string): Promise<DriveFolder | null> {
  const drive = await getDriveClient();

  let query = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name, webViewLink)',
    pageSize: 1,
  });

  const folder = response.data.files?.[0];
  if (!folder) return null;

  return {
    id: folder.id!,
    name: folder.name!,
    webViewLink: folder.webViewLink || '',
  };
}

export async function createProjectFolderStructure(
  clientName: string,
  selectedCount: number,
  parentFolderId?: string
): Promise<{ mainFolder: DriveFolder; bwFolder: DriveFolder }> {
  const folderName = `${clientName.toUpperCase()} (${selectedCount})`;

  const mainFolder = await createFolder(folderName, parentFolderId);
  const bwFolder = await createFolder('Black and White', mainFolder.id);

  console.log(`📁 Created project folder structure: ${folderName} with Black and White subfolder`);
  return { mainFolder, bwFolder };
}

export async function getImageThumbnails(folderId: string, maxResults: number = 5): Promise<DriveFileInfo[]> {
  const files = await listFilesInFolder(folderId);
  const images = files.filter(f => f.mimeType.startsWith('image/'));
  return images.slice(0, maxResults);
}

export async function testDriveConnection(): Promise<{ connected: boolean; email?: string; error?: string }> {
  try {
    const drive = await getDriveClient();
    const about = await drive.about.get({ fields: 'user' });
    return {
      connected: true,
      email: about.data.user?.emailAddress || undefined,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
    };
  }
}
