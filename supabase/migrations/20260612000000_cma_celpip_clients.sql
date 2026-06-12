-- Migration: Add CMA US and CELPIP as clients to database
INSERT INTO clients (name, color, softwares)
VALUES 
  ('CMA US', 'emerald', ARRAY[]::text[]),
  ('CELPIP', 'rose', ARRAY[]::text[])
ON CONFLICT (name) DO NOTHING;
