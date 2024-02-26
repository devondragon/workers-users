/* This is no longer needed but am keeping it as a reference point to add migrations in later */

ALTER TABLE User ADD COLUMN ResetToken Text;
ALTER TABLE User ADD COLUMN ResetTokenTime DATETIME;
