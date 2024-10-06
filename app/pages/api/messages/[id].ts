import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js';
import { SignedMessageWithProof } from '../../../lib/types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select(
        "id, text, timestamp, domain, signature, pubkey, pubkeys(proof, kid)"
      )
      .eq('id', id)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message : SignedMessageWithProof = {
      id: data.id,
      text: data.text,
      timestamp: data.timestamp,
      domain: data.domain,
      signature: data.signature,
      pubkey: data.pubkey,
      // @ts-expect-error pubkeys is not an array
      proof: JSON.parse(data.pubkeys.proof),
      // @ts-expect-error pubkeys is not an array
      kid: data.pubkeys.kid,
    }

    return res.json(message);
  } catch (error) {
    console.error('Error fetching message:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}