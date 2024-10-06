import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { verifyPubkeyZKProof } from '../../lib/utils';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { domain, pubkey, kid, proof } = req.body;

    try {
      const isValid = await verifyPubkeyZKProof(domain, pubkey, kid, Uint8Array.from(proof));
      if (!isValid) {
        throw new Error('Invalid proof');
      }

      const {  error } = await supabase
        .from('pubkeys')
        .insert([
          { domain, pubkey: pubkey, kid: kid, proof: JSON.stringify(proof) }
        ]);

      if (error) throw error;

      res.status(200).json({ success: true, message: 'Registration successful' });
    } catch (error) {
      console.error('Error registering pubkey:', error);
      res.status(500).json({ success: false, message: 'Error registering pubkey' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}