import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { TwitterApi } from 'twitter-api-v2';
import companies from './companies.json';

interface Message {
  id: number;
  text: string;
  groupId: boolean;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

/**
 * Fetches latest untweeted messages from Supabase
 */
const getLatestMessages = async (): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, text, groupId:group_id')
    .eq('internal', false)
    .eq('tweeted', false)
    .gt('likes', 0)
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
const markMessageAsTweeted = async (messageId: number): Promise<void> => {
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
    const company = companies[message.groupId] ? `${companies[message.groupId]}` : message.groupId;
    const prefix = `Someone from ${company} said:\n\n`;
    const suffix = `\n\nVerify: https://stealthnote.xyz/messages/${message.id}`;
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

const run = async (): Promise<void> => {
  console.log('Starting Twitter bot...');
  
  const messages = await getLatestMessages();
  
  for (const message of messages) {
    const success = await postTweet(message);
    if (success) {
      await markMessageAsTweeted(message.id);
    }
    // Add a delay between tweets to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('Finished processing messages');
};

// Run the bot
run().catch(console.error); 