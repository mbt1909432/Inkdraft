import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';

const LOG_TAG = '[api/api-keys]';

// Generate a random API key
function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  // Generate 32 bytes of random data
  const randomBytes_ = randomBytes(32);
  // Convert to base64url and take first 43 chars (256 bits)
  const key = 'sk_' + randomBytes_.toString('base64url').slice(0, 43);

  // Hash the key for storage
  const keyHash = createHash('sha256').update(key).digest('hex');

  // Store prefix for display (sk_ + first 6 chars)
  const keyPrefix = key.slice(0, 12) + '...';

  return { key, keyHash, keyPrefix };
}

// GET - List user's API keys
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(LOG_TAG, 'Error fetching API keys', error);
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }

    return NextResponse.json({ keys: data });
  } catch (err) {
    console.error(LOG_TAG, 'Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new API key
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = body.name || 'API Key';

    // Validate name
    if (typeof name !== 'string' || name.length > 100) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    // Check max keys per user (limit to 10)
    const { count, error: countError } = await supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error(LOG_TAG, 'Error counting API keys', countError);
      return NextResponse.json({ error: 'Failed to check API keys' }, { status: 500 });
    }

    if (count && count >= 10) {
      return NextResponse.json({ error: 'Maximum 10 API keys allowed' }, { status: 400 });
    }

    // Generate new key
    const { key, keyHash, keyPrefix } = generateApiKey();

    // Store in database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
      })
      .select('id, name, key_prefix, created_at')
      .single();

    if (error) {
      console.error(LOG_TAG, 'Error creating API key', error);
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }

    // Return the key ONCE (only time user will see it)
    return NextResponse.json({
      ...data,
      key, // Full key - only shown once!
    });
  } catch (err) {
    console.error(LOG_TAG, 'Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
