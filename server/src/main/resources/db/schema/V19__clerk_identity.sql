ALTER TABLE users ADD COLUMN clerk_user_id varchar(64);
ALTER TABLE users ADD CONSTRAINT uq_users_clerk_user_id UNIQUE (clerk_user_id);
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
