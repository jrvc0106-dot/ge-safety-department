/**
 * Native Capacitor Filesystem bridge for G&E ONE Local (development only).
 * Inject {Filesystem, Directory} from @capacitor/filesystem after native plugin install.
 * Original binary bytes use base64 only for the plugin transport, NOT recompression.
 */
const root = 'ge-one-local/v1/evidence/';
function checkedPath(path) {
  if (typeof path !== 'string' || !path.startsWith(root) || path.includes('\\') ||
      path.split('/').some(part => !part || part === '.' || part === '..') || path.length > 400) {
    throw new TypeError('Invalid native evidence path');
  }
  return path;
}
function missing(err) {
  const message = String(err?.message ?? err);
  return /(?:not found|does not exist|no such file|ENOENT|not exist)/i.test(message);
}
function toBase64(bytes) {
  let result = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(result);
}
function fromBase64(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
export function createCapacitorFileDriver({Filesystem, Directory}) {
  if (!Filesystem || !Directory?.Data ||
      ['readFile', 'writeFile', 'rename', 'deleteFile'].some(name => typeof Filesystem[name] !== 'function')) {
    throw new TypeError('Capacitor native filesystem is not configured');
  }
  const dir = Directory.Data;
  return {
    async read(path) {
      const p = checkedPath(path);
      try {
        const response = await Filesystem.readFile({path:p, directory:dir});
        if (typeof response.data === 'string') return fromBase64(response.data);
        if (response.data && typeof response.data.arrayBuffer === 'function') {
          return new Uint8Array(await response.data.arrayBuffer());
        }
        throw new Error('Unexpected Capacitor evidence response');
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },
    async write(path, bytes) {
      if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected binary evidence');
      await Filesystem.writeFile({
        path:checkedPath(path), data:toBase64(bytes), directory:dir, recursive:true
      });
    },
    async move(from, to) {
      await Filesystem.rename({
        from:checkedPath(from), to:checkedPath(to), directory:dir, toDirectory:dir
      });
    },
    async remove(path) {
      try { await Filesystem.deleteFile({path:checkedPath(path),directory:dir}); }
      catch (err) { if (!missing(err)) throw err; }
    }
  };
}
