-- Cover foreign keys used by project filters, joins and cascading deletes.
-- Existing indexes and access policies remain intact.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create index if not exists backup_cloud_connections_connected_by_idx on public.backup_cloud_connections (connected_by);
create index if not exists backup_cloud_oauth_states_project_id_idx on public.backup_cloud_oauth_states (project_id);
create index if not exists backup_cloud_oauth_states_user_id_idx on public.backup_cloud_oauth_states (user_id);
create index if not exists backup_cloud_settings_updated_by_idx on public.backup_cloud_settings (updated_by);
create index if not exists form_drafts_project_id_idx on public.form_drafts (project_id);
create index if not exists inventory_item_photos_uploaded_by_idx on public.inventory_item_photos (uploaded_by);
create index if not exists inventory_items_created_by_idx on public.inventory_items (created_by);
create index if not exists inventory_items_updated_by_idx on public.inventory_items (updated_by);
create index if not exists safety_orientation_events_actor_id_idx on public.safety_orientation_events (actor_id);
create index if not exists safety_orientation_events_orientation_id_idx on public.safety_orientation_events (orientation_id);
create index if not exists safety_orientations_created_by_idx on public.safety_orientations (created_by);
create index if not exists safety_orientations_employee_profile_id_idx on public.safety_orientations (employee_profile_id);
create index if not exists safety_orientations_project_id_idx on public.safety_orientations (project_id);
create index if not exists safety_orientations_updated_by_idx on public.safety_orientations (updated_by);
