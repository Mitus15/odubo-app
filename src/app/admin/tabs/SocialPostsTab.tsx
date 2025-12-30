'use client';

import SocialPostingPanel from '@/app/command-center/components/social/SocialPostingPanel';

/**
 * Admin wrapper for the Social Posting Panel
 * Provides the full social posting experience within the admin dashboard
 */
export default function SocialPostsTab() {
  return (
    <div className="h-full">
      <SocialPostingPanel />
    </div>
  );
}
