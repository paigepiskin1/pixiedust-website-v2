-- Credit expiry (Terms §12.5): Add-On credits expire after 90 days,
-- subscription credits at the end of the billing period.
--
-- Additive and idempotent. Existing balances are grandfathered into a single
-- never-expiring "legacy" lot per user, so this migration cannot cause anyone
-- to lose credits they already hold.

CREATE TABLE IF NOT EXISTS credit_lots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  source     TEXT    NOT NULL,              -- addon | subscription | promo | legacy | refund
  amount     INTEGER NOT NULL,              -- credits originally granted
  remaining  INTEGER NOT NULL,              -- unspent (0 once used up or expired)
  expires_at TEXT,                          -- 'YYYY-MM-DD HH:MM:SS' UTC; NULL = never
  ref_type   TEXT,
  ref_id     TEXT,
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sweep + allocation both filter on (user, remaining, expires_at).
CREATE INDEX IF NOT EXISTS idx_credit_lots_user_exp ON credit_lots(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_credit_lots_live     ON credit_lots(user_id, remaining, expires_at);

-- Records which lots a debit drew from, so a refund restores the same expiries.
ALTER TABLE credit_ledger ADD COLUMN lots_json TEXT;

-- Grandfather current balances: one never-expiring lot per user with a positive
-- balance. Skips users that already have lots so re-running is safe.
INSERT INTO credit_lots (user_id, source, amount, remaining, expires_at, note)
SELECT u.id, 'legacy', u.balance, u.balance, NULL, 'grandfathered at expiry launch'
FROM users u
WHERE u.balance > 0
  AND NOT EXISTS (SELECT 1 FROM credit_lots l WHERE l.user_id = u.id);
