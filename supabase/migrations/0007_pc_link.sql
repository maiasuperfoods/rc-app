-- Link a brand (tenant) to its Private Circle student record in the admin project.
alter table tenants add column if not exists pc_student_id uuid unique;
