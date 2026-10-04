alter table public.safety_tool_records
 drop constraint if exists safety_tool_records_kind_check;
alter table public.safety_tool_records
 add constraint safety_tool_records_kind_check
 check (kind in ('toolbox','training','safety_net','emergency','director','qr','hazard'));

alter table public.report_documents
 drop constraint if exists report_documents_report_type_check;
alter table public.report_documents
 add constraint report_documents_report_type_check
 check (report_type in (
  'daily_report','daily_safety_walk','observation','correction','disciplinary_action',
  'incident','near_miss','jha','toolbox','equipment_inspection','training','inventory',
  'tool_toolbox','tool_training','tool_safety_net','tool_emergency','tool_director','tool_qr','tool_hazard'
 ));
