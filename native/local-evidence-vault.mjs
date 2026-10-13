/**
 * G&E ONE private-device evidence vault contract (migration branch only).
 * Preserves original bytes; does not resize photos or PDFs.
 * Requires an injected device filesystem driver; no Supabase/Vercel APIs.
 * Paths and hashes check integrity; they do not replace authorization.
 */
const extensions = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
  'application/pdf': 'pdf'
});
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const sha256Pattern = /^[a-f0-9]{64}$/;
const prefix = 'ge-one-local/v1/evidence';
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 is unavailable on this device');
  const result = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(result), x => x.toString(16).padStart(2, '0')).join('');
}
function validBytes(bytes) {
  return bytes instanceof Uint8Array && bytes.byteLength > 0;
}
function validMetadata(file) {
  return Boolean(file && typeof file === 'object' &&
    safeId(file.projectId) && safeId(file.recordId) &&
    Object.hasOwn(extensions, file.mimeType) &&
    typeof file.path === 'string' &&
    file.path === prefix + '/' + file.projectId + '/' + file.recordId + '/' +
      file.sha256 + '.' + extensions[file.mimeType] &&
    sha256Pattern.test(file.sha256) &&
    Number.isSafeInteger(file.size) && file.size > 0);
}
function ensureMeta(file, projectId, recordId) {
  if (!validMetadata(file)) throw new TypeError('Untrusted or invalid evidence metadata');
  if (file.projectId !== projectId || file.recordId !== recordId) {
    throw new Error('Evidence belongs to a different project or report');
  }
}
async function verifiedRead(driver, path, length, hash) {
  const bytes = await driver.read(path);
  if (!bytes) throw new Error('Local evidence is missing; restore from an independent backup');
  if (!validBytes(bytes) || bytes.byteLength !== length || await sha256(bytes) !== hash) {
    throw new Error('Local evidence integrity check failed');
  }
  return bytes;
}
/**
 * driver: { read(path): Promise<Uint8Array|null>, write(path,Uint8Array),
 *           move(from,to), remove(path) }
 */
export function createLocalEvidenceVault(driver, {maxBytes = DEFAULT_MAX_BYTES} = {}) {
  if (!driver || ['read', 'write', 'move', 'remove'].some(method => typeof driver[method] !== 'function')) {
    throw new TypeError('A private device filesystem driver is required');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('Invalid evidence size limit');
  return {
    async save({projectId, recordId, fileName = '', mimeType, bytes}) {
      if (!safeId(projectId) || !safeId(recordId)) throw new TypeError('Invalid project or report ID');
      if (!Object.hasOwn(extensions, mimeType)) throw new TypeError('Unsupported evidence type');
      if (!validBytes(bytes) || bytes.byteLength > maxBytes) throw new RangeError('Evidence exceeds the allowed size');
      if (typeof fileName !== 'string') throw new TypeError('Invalid evidence file name');
      const copy = new Uint8Array(bytes);
      const digest = await sha256(copy);
      const path = prefix + '/' + projectId + '/' + recordId + '/' +
        digest + '.' + extensions[mimeType];
      const meta = Object.freeze({
        projectId, recordId, path, mimeType, size: copy.byteLength,
        sha256: digest, name: fileName.slice(0, 200).replace(/[\r\n]/g, ' ')
      });
      const existing = await driver.read(path);
      if (existing !== null) {
        await verifiedRead(driver, path, meta.size, meta.sha256);
        return meta;
      }
      const temp = path + '.' + globalThis.crypto.randomUUID() + '.tmp';
      try {
        await driver.write(temp, copy);
        await verifiedRead(driver, temp, meta.size, meta.sha256);
        try {
          await driver.move(temp, path);
        } catch (err) {
          try { await verifiedRead(driver, path, meta.size, meta.sha256); }
          catch { throw err; }
        }
        await verifiedRead(driver, path, meta.size, meta.sha256);
        return meta;
      } finally {
        await driver.remove(temp).catch(() => {});
      }
    },
    async read(meta, {projectId, recordId}) {
      ensureMeta(meta, projectId, recordId);
      if (meta.size > maxBytes) throw new RangeError('Evidence exceeds the allowed size');
      return verifiedRead(driver, meta.path, meta.size, meta.sha256);
    },
    async verify(meta, context) {
      ensureMeta(meta, context.projectId, context.recordId);
      await verifiedRead(driver, meta.path, meta.size, meta.sha256);
      return true;
    }
  };
}
