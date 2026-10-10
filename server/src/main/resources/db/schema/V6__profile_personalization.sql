ALTER TABLE users ADD COLUMN tagline varchar(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_seed varchar(100);
UPDATE users SET avatar_seed = username;
ALTER TABLE users ALTER COLUMN avatar_seed SET NOT NULL;

CREATE TABLE user_profile_interests (
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position integer NOT NULL,
    interest varchar(40) NOT NULL,
    PRIMARY KEY (user_id, position),
    UNIQUE (user_id, interest) DEFERRABLE INITIALLY DEFERRED,
    CHECK (position BETWEEN 0 AND 4),
    CHECK (interest IN ('WEB', 'NETWORKS', 'LINUX', 'WINDOWS', 'PENTESTING', 'SOC', 'FORENSICS', 'CRYPTOGRAPHY', 'REVERSE_ENGINEERING', 'PROGRAMMING'))
);

CREATE TABLE user_featured_badges (
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position integer NOT NULL,
    badge_id bigint NOT NULL,
    PRIMARY KEY (user_id, position),
    UNIQUE (user_id, badge_id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (user_id, badge_id) REFERENCES user_badges(user_id, badge_id) ON DELETE CASCADE,
    CHECK (position BETWEEN 0 AND 2)
);
