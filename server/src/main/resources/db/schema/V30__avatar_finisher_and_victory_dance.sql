ALTER TABLE user_avatars ADD COLUMN finisher varchar(16) NOT NULL DEFAULT 'beam';
ALTER TABLE user_avatars ADD COLUMN victory_dance varchar(16) NOT NULL DEFAULT 'groove';
ALTER TABLE user_avatars ADD CONSTRAINT ck_user_avatars_finisher CHECK (finisher IN ('beam', 'combo'));
ALTER TABLE user_avatars ADD CONSTRAINT ck_user_avatars_victory_dance CHECK (victory_dance IN ('groove', 'sixseven', 'scuba'));
