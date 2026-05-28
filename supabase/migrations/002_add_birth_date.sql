-- Migration to add birth_date to profiles for birthday notifications

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS birth_date DATE;
