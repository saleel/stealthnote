import type { NextApiRequest, NextApiResponse } from 'next';
import { TwitterApi } from 'twitter-api-v2';
import { createClient } from '@supabase/supabase-js';
import twitterHandles from '../../assets/twitter-handles.json';
import { Message } from '../../lib/types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const messages = await getLatestMessages();

    if (messages.length === 0) {
      console.log('No messages to tweet');
      return res.status(200).json({ success: true });
    }

    for (const message of messages) {
      const success = await postTweet(message);
      if (!success) {
        console.error(`Error posting tweet: ${message.text}`);
        throw new Error(`Error posting tweet: ${message.text}`);
      } else {
        console.log(`Successfully tweeted: ${message.text}`);
        await markMessageAsTweeted(message.id);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error posting tweet:', error);
    return res.status(500).json({ success: false, error: 'Failed to post tweet' });
  }
}

/**
 * Fetches latest untweeted messages from Supabase
 */
const getLatestMessages = async (): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, text, anonGroupId:group_id')
    .eq('internal', false)
    .eq('tweeted', false)
    .gt('likes', 0)
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('likes', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data as unknown as Message[];
};

/**
 * Marks a message as tweeted in Supabase
 */
const markMessageAsTweeted = async (messageId: string): Promise<void> => {
  const { error } = await supabase
    .from('messages')
    .update({ tweeted: true })
    .eq('id', messageId);

  if (error) {
    console.error('Error marking message as tweeted:', error);
  }
};

/**
 * Posts a message to Twitter
 */
const postTweet = async (message: Message): Promise<boolean> => {
  try {
    const companyDomain = message.anonGroupId as keyof typeof twitterHandles;
    
    const companyText = message.anonGroupId in twitterHandles
      ? `@${twitterHandles[companyDomain]} (${companyDomain})`
      : companyDomain;
    const prefix = `Someone from ${companyText} said:\n\n`;
    const suffix = `\n\nVerify: https://stealthnote.xyz/messages/${message.id}?t.co=true`;
    const maxTweetLength = 280;
    const maxContentLength = maxTweetLength - prefix.length - suffix.length;

    if (message.text.length <= maxContentLength) {
      // If message fits in one tweet
      const tweet = prefix + message.text + suffix;
      await twitterClient.v2.tweet(tweet);
    } else {
      // Split into multiple tweets
      const parts = message.text.match(new RegExp(`.{1,${maxContentLength}}`, 'g')) || [];

      // Post first tweet
      const firstTweet = await twitterClient.v2.tweet(prefix + parts[0] + ' (1/?)');

      // Post subsequent tweets as replies
      let previousTweetId = firstTweet.data.id;
      for (let i = 1; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const partNum = `(${i + 1}/${parts.length})`;
        const tweetText = parts[i] + (isLast ? suffix : ` ${partNum}`);

        const reply = await twitterClient.v2.tweet(tweetText, {
          reply: { in_reply_to_tweet_id: previousTweetId }
        });
        previousTweetId = reply.data.id;
      }
    }
    console.log('Successfully tweeted:', message.text);
    return true;
  } catch (error) {
    console.error('Error posting tweet:', error);
    return false;
  }
};
