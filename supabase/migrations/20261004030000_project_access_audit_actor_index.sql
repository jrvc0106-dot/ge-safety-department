create index if not exists project_access_audit_actor_changed_idx
 on public.project_access_audit(actor_id, changed_at desc);
