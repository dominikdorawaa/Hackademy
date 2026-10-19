ALTER TABLE user_notification_preferences ALTER COLUMN sound SET DEFAULT TRUE;
UPDATE user_notification_preferences SET sound = TRUE;
