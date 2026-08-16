-- RAAHI MINI — MIGRATION 10
-- Explicit terminal passenger state when a confirmed ride is cancelled by driver.
-- Kept separate because PostgreSQL enum values must commit before use.

ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'DRIVER_CANCELLED';
