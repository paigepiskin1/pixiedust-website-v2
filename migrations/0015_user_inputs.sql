-- Store original user form inputs so generations can be reused (prompt + reference images).
ALTER TABLE generations ADD COLUMN user_inputs_json TEXT;
