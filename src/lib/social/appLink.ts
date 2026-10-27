/**
 * The Studio's link to the apps through Post for Me, the parts both sides
 * share: which connected account a platform means, what a YouTube upload is
 * called, and an app's refusal in a sentence.
 */
import { kindOf, type QueuePost } from './postQueue';

export interface LinkedAccount {
  id: string;
  platform: string;
  username?: string;
  status: string;
}

/** The connected account that posts to a platform. TikTok's business login is a different, older connection. */
export function accountFor<T extends LinkedAccount>(accounts: T[], platform: string): T | null {
  return accounts.find((a) => a.platform === platform && a.status === 'connected') || null;
}

/**
 * What a YouTube upload is called, before he changes it: a full song takes its
 * campaign's name ("1-2 · Fils de joie", "Training · Monkey"), and the
 * description is the caption, then the song's credit from the note's first
 * line ("Monkey · M.I Abaga").
 */
export function youtubeDetails(
  post: Pick<QueuePost, 'caption' | 'notes' | 'tags' | 'platforms' | 'campaign_id'>,
  campaigns: { id: string; name: string }[],
): { title: string; description: string } {
  const campaign = campaigns.find((c) => c.id === post.campaign_id);
  const caption = (post.caption || '').trim();
  const title = (kindOf(post) === 'full' && campaign?.name) || caption || 'Untitled';
  const credit = (post.notes || '').split('\n')[0]?.trim();
  const description = [caption, credit && credit.includes(' · ') ? credit : ''].filter(Boolean).join('\n\n');
  return { title: title.slice(0, 100), description };
}

/** An app's refusal, as one sentence he can act on. */
export function plainError(error: unknown): string {
  const text = typeof error === 'string' ? error : error && typeof error === 'object' ? JSON.stringify(error) : '';
  if (/quota/i.test(text) && /youtube/i.test(text)) {
    return "YouTube's daily upload limit for Post for Me is used up. Try again tomorrow, or upload in YouTube Studio.";
  }
  if (/not connected|disconnected|expired|reauth/i.test(text)) return 'The account needs connecting again in Post for Me.';
  const first = text.split(/[{\n]/)[0].trim();
  return (first || 'The app did not take it.').slice(0, 160);
}
