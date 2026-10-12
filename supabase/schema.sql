-- Run once in Supabase SQL Editor as postgres. Safe to re-run without deleting records.
BEGIN;
CREATE SCHEMA IF NOT EXISTS helio;
REVOKE ALL ON SCHEMA helio FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS helio.users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','worker')), active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS helio.sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS helio.settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS helio.customers(id TEXT PRIMARY KEY,eb TEXT NOT NULL UNIQUE,assigned TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS helio.events(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,user_id TEXT NOT NULL,author TEXT NOT NULL,kind TEXT NOT NULL,text TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS helio.files(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,type TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS helio.outbox(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,customer_id TEXT NOT NULL,text TEXT NOT NULL,state TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS helio.attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS helio.webhook_inbox(id TEXT PRIMARY KEY,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS customers_assigned_idx ON helio.customers(assigned);
CREATE INDEX IF NOT EXISTS events_customer_created_idx ON helio.events(customer_id,created);
CREATE INDEX IF NOT EXISTS files_customer_idx ON helio.files(customer_id);
CREATE INDEX IF NOT EXISTS outbox_state_created_idx ON helio.outbox(state,created);
ALTER TABLE helio.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE helio.webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA helio FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('helio-quotations','helio-quotations',false,3500000,ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=3500000,allowed_mime_types=EXCLUDED.allowed_mime_types;
COMMIT;
