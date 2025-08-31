-- Add stem fields to tracks table
ALTER TABLE tracks ADD COLUMN vocal_stem_url TEXT;
ALTER TABLE tracks ADD COLUMN drum_stem_url TEXT;
ALTER TABLE tracks ADD COLUMN bass_stem_url TEXT;
ALTER TABLE tracks ADD COLUMN other_stem_url TEXT;
ALTER TABLE tracks ADD COLUMN processing_status TEXT DEFAULT 'pending';
