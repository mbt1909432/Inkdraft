-- Add expiration support to API keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN api_keys.expires_at IS 'When the API key expires. NULL means never expires.';
