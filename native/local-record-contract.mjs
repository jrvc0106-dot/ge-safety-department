/**
 * G&E ONE local-first migration: versioned device-record contract.
 * This is infrastructure for the *future* native SQLite adapter.
 * It intentionally does not replace Supabase in the published application.
 * Authorization / cross-device revocation must be verified separately.
 */
export const LOCAL_COLLECTIONS = Object.freeze([
  'projects', 'profiles', 'project_members',
  'observations', 'corrective_actions', 'safety_discipline',
  'daily_safety_walks', 'incident_reports', 'equipment_inspections',
  'inventory_items', 'safety_orientations', 'quick_safety_orientations',
  'safety_tool_records', 'form_drafts', 'report_documents',
  'notifications', 'app_performance_events'
]);

const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const safePath = value =>
  typeof value === 'string' && value.length > 0 && value.length <= 1000 &&
  !value.startsWith('/') && !value.includes('\\') &&
  value.split('/').every(part => part && part !== '.' && part !== '..');

export function validateLocalRecord(value) {
  if (!object(value)) throw new TypeError('Record must be an object');
  if (!LOCAL_COLLECTIONS.includes(value.collection)) throw new TypeError('Unsupported collection');
  if (!safeId(value.id) || !safeId(value.project_id)) throw new TypeError('Invalid record or project ID');
  if (!object(value.payload)) throw new TypeError('Payload must be an object');
  if (!Array.isArray(value.attachments ?? [])) throw new TypeError('Attachments must be an array');
  for (const file of value.attachments ?? []) {
    if (!object(file) || !safePath(file.path) ||
        !Number.isSafeInteger(file.size) || file.size < 0 ||
        typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(file.sha256)) {
      throw new TypeError('Invalid attachment metadata');
    }
  }
  // Force JSON-safe copies: IDs and relative paths are stored separately from file bytes.
  let payload, attachments;
  try {
    payload = JSON.parse(JSON.stringify(value.payload));
    attachments = JSON.parse(JSON.stringify(value.attachments ?? []));
  } catch {
    throw new TypeError('Record must contain serializable data');
  }
  return {
    collection: value.collection,
    id: value.id,
    project_id: value.project_id,
    payload,
    attachments
  };
}

/**
 * Adapter contract: get(collection,id), upsert(record), list(collection,projectId).
 * No UI, network, or privileged token is accepted by this API.
 */
export function createLocalRecordRepository(adapter, { now = () => new Date().toISOString() } = {}) {
  if (!adapter || ['get', 'upsert', 'list'].some(name => typeof adapter[name] !== 'function')) {
    throw new TypeError('A persistent local storage adapter is required');
  }
  return {
    async save(value) {
      const record = validateLocalRecord(value);
      const previous = await adapter.get(record.collection, record.id);
      if (previous && previous.project_id !== record.project_id) {
        throw new Error('A record cannot be reassigned to another project');
      }
      const revision = (previous?.revision ?? 0) + 1;
      if (!Number.isSafeInteger(revision) || revision <= 0) throw new Error('Invalid revision');
      const saved = { ...record, revision, updated_at: now() };
      await adapter.upsert(saved);
      return saved;
    },
    async get(collection, id) {
      if (!LOCAL_COLLECTIONS.includes(collection) || !safeId(id)) throw new TypeError('Invalid lookup');
      return adapter.get(collection, id);
    },
    async list(collection, projectId) {
      if (!LOCAL_COLLECTIONS.includes(collection) || !safeId(projectId)) throw new TypeError('Invalid project lookup');
      return adapter.list(collection, projectId);
    }
  };
}
