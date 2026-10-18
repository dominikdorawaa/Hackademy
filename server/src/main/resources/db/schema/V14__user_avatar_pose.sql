ALTER TABLE user_avatars ADD COLUMN pose varchar(16) NOT NULL DEFAULT 'przod';
ALTER TABLE user_avatars ADD CONSTRAINT ck_user_avatars_pose CHECK (pose IN ('przod', 'postawa', 'profil'));
