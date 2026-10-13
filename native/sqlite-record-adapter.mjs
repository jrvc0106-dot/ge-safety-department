/**
 * SQLite adapter for createLocalRecordRepository().
 * Call after opening an encrypted native SQLite connection.
 * This module never accesses Supabase, Vercel, or the network.
 */
export async function createSQLiteRecordAdapter(connection) {
  if (!connection || typeof connection.execute !== 'function' ||
      typeof connection.query !== 'function' || typeof connection.run !== 'function') {
    throw new TypeError('An open native SQLite connection is required');
  }
  await connection.execute(
    'CREATE TABLE IF NOT EXISTS ge_local_records (' +
      'collection TEXT NOT NULL, id TEXT NOT NULL, project_id TEXT NOT NULL, ' +
      'revision INTEGER NOT NULL, updated_at TEXT NOT NULL, body TEXT NOT NULL, ' +
      'PRIMARY KEY (collection, id))'
  );
  await connection.execute(
    'CREATE INDEX IF NOT EXISTS ge_local_records_by_project ' +
      'ON ge_local_records (project_id, collection, updated_at)'
  );
  const parse = row => {
    if (!row) return null;
    const value = JSON.parse(row.body);
    if (value.collection !== row.collection || value.id !== row.id ||
        value.project_id !== row.project_id) throw new Error('Local SQLite record integrity mismatch');
    return value;
  };
  return {
    async get(collection, id) {
      const result = await connection.query(
        'SELECT collection, id, project_id, body FROM ge_local_records WHERE collection = ? AND id = ?',
        [collection, id]
      );
      return parse(result.values?.[0]);
    },
    async list(collection, projectId) {
      const result = await connection.query(
        'SELECT collection, id, project_id, body FROM ge_local_records WHERE collection = ? AND project_id = ? ORDER BY updated_at DESC',
        [collection, projectId]
      );
      return (result.values ?? []).map(parse);
    },
    async upsert(record) {
      if (!record || !Number.isSafeInteger(record.revision) || record.revision < 1) {
        throw new TypeError('Invalid local record revision');
      }
      const result = await connection.run(
        'INSERT INTO ge_local_records (collection,id,project_id,revision,updated_at,body) ' +
        'VALUES (?,?,?,?,?,?) ' +
        'ON CONFLICT(collection,id) DO UPDATE SET ' +
        'revision=excluded.revision,updated_at=excluded.updated_at,body=excluded.body ' +
        'WHERE ge_local_records.project_id=excluded.project_id ' +
        'AND ge_local_records.revision < excluded.revision',
        [record.collection, record.id, record.project_id, record.revision,
          record.updated_at, JSON.stringify(record)]
      );
      if (result.changes?.changes === 0) {
        throw new Error('Stale write or project mismatch');
      }
    }
  };
}
