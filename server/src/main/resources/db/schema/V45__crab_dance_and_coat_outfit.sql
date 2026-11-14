ALTER TABLE user_avatars DROP CONSTRAINT ck_user_avatars_victory_dance;
ALTER TABLE user_avatars ADD CONSTRAINT ck_user_avatars_victory_dance CHECK (victory_dance IN ('groove', 'sixseven', 'scuba', 'crab'));

ALTER TABLE user_avatars DROP CONSTRAINT ck_user_avatars_outfit;
ALTER TABLE user_avatars ADD CONSTRAINT ck_user_avatars_outfit CHECK (outfit IN ('baza', 'bluza', 'dres', 'plaszcz'));
