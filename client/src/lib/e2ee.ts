const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

function getStorageKey(projectId: string, role: string): string {
  return `e2ee-key-${projectId}-${role}`;
}

async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function importKey(keyStr: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyStr), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function getOrCreateKey(projectId: string, role: string): Promise<CryptoKey> {
  const storageKey = getStorageKey(projectId, role);
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return await importKey(stored);
    }
  } catch {}

  const key = await generateEncryptionKey();
  const exported = await exportKey(key);
  try { localStorage.setItem(storageKey, exported); } catch {}
  return key;
}

export async function storeKeyFromRemote(projectId: string, role: string, keyStr: string): Promise<CryptoKey> {
  const storageKey = getStorageKey(projectId, role);
  try { localStorage.setItem(storageKey, keyStr); } catch {}
  return await importKey(keyStr);
}

export async function getExportedKey(projectId: string, role: string): Promise<string | null> {
  const storageKey = getStorageKey(projectId, role);
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export async function encryptMessage(message: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(message);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return 'e2ee:' + btoa(String.fromCharCode(...combined));
}

export async function decryptMessage(ciphertext: string, key: CryptoKey): Promise<string> {
  if (!ciphertext.startsWith('e2ee:')) return ciphertext;
  const data = Uint8Array.from(atob(ciphertext.slice(5)), c => c.charCodeAt(0));
  const iv = data.slice(0, IV_LENGTH);
  const encrypted = data.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

export function isEncrypted(message: string): boolean {
  return message.startsWith('e2ee:');
}
