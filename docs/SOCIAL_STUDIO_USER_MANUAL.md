# Social Studio User Manual

*Last Updated: January 24, 2026*

---

## Table of Contents

1. [Overview](#overview)
2. [How Scheduling Works](#how-scheduling-works)
3. [Getting Started](#getting-started)
4. [Creating & Scheduling Posts](#creating--scheduling-posts)
5. [Settings Configuration](#settings-configuration)
6. [Publishing Your Posts](#publishing-your-posts)
7. [Managing Your Content](#managing-your-content)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Social Studio is your campaign management hub for scheduling and publishing social media posts across multiple platforms. The system is designed to let you **queue posts days or weeks in advance** without needing to stay online.

### Key Features

- **Queue & Publish**: Schedule posts by date, publish when you're ready
- **Multiple Slots Per Day**: Organize multiple posts per day using slot numbers
- **Manual Control**: You decide exactly when posts go live
- **AI Captions**: Gemini AI generates platform-specific captions and hashtags
- **Multi-Platform**: Instagram, TikTok, YouTube, Facebook, Threads, Twitter, LinkedIn, Pinterest, Bluesky
- **Campaign Organization**: Group related posts into campaigns
- **Clip Library**: Reuse existing video clips from your library

---

## How Scheduling Works

### Manual Publishing Model

Social Studio uses a **queue-and-publish** workflow. You schedule posts for specific dates, then manually publish them when you're ready using the **Publish** button.

This gives you full control over timing — publish when engagement is highest, when you're online to respond to comments, or whenever feels right.

### Day + Slot Organization

Posts are organized by **date** and **slot number**:

- **Date**: Choose which day the post is intended for
- **Slot Number**: Organize multiple posts on the same day (Slot 1, Slot 2, etc.)

**Example**:
- Monday, Slot 1 → First post planned for Monday
- Monday, Slot 2 → Second post planned for Monday
- Tuesday, Slot 1 → First post planned for Tuesday

### Slot Numbers Explained

Slot numbers are **organizational labels** to help you:
- Keep track of which post is "first" vs "second" on a given day
- Preview your daily posting schedule
- Maintain a consistent posting order

**Posts don't publish automatically** — you decide when to hit Publish.

---

## Getting Started

### Accessing Social Studio

1. Navigate to **Admin** → **Social Studio** tab
2. You'll see the main dashboard with:
   - **Today's Posts**: Scheduled for today
   - **Attention Needed**: Draft posts or failed publishes
   - **Quick Stats**: Performance overview

### Connecting Accounts

Before creating posts, connect your social media accounts:

1. Go to **Settings** (top navigation)
2. Scroll to **Connected Accounts**
3. Click **"+ Add Account"** for each platform
4. Follow OAuth flow to authorize
5. Accounts appear as active once connected

**Supported Platforms**:
- Instagram, TikTok, YouTube, Facebook, Threads, Twitter, LinkedIn, Pinterest, Bluesky

---

## Creating & Scheduling Posts

### Step 1: Start a New Post

From the **Home** view, click **"+ Create Post"**. You'll enter a 3-step wizard:

#### **Content Selection**

Choose your media source:

- **📱 From Clips**: Select from your existing video library
  - Toggle "Unposted Only" to see clips not yet used
  - Clips show an "Unused" badge if never posted
- **📁 Upload Media**: Upload new image/video from device
- **📸 Take Photo/Video**: Capture directly from camera
- **🔗 From URL**: Paste direct media URL

### Step 2: Post Details

#### **Select Platforms**

- All active accounts are selected by default
- Uncheck any platforms you don't want to post to
- Platform icons show at the top of the form

#### **Write Caption**

- Manual entry in the text area
- Or click **"🤖 AI Suggest"** for Gemini-generated captions
  - Choose platform (defaults to Instagram)
  - AI analyzes your media and generates 3 caption options
  - Captions are platform-optimized with voice/tone matching
  - Upvote/downvote to improve suggestions

#### **Add Hashtags**

- Type hashtags separated by spaces or commas
- Or use AI suggestions (if enabled)
- Max hashtags configurable in Settings (default: 30)

#### **Assign to Campaign** (Optional)

- Select existing campaign or leave blank
- Campaigns help organize related posts (e.g., "Product Launch", "Holiday Sale")

### Step 3: Schedule

You have two publishing options:

#### **Post Now**

- Publishes immediately to all selected platforms
- Use for urgent or real-time content

#### **Schedule for a Day**

This is where day-based scheduling happens:

1. **Select Date**: Use date picker (minimum: today)
2. **Choose Slot Number**: Click Slot 1, Slot 2, etc.
   - Number of slots depends on your Settings (default: 2)
   - Pick an available slot or overwrite existing
3. **Review**: See final preview with date and slot

**Note**: The post won't publish automatically — use the **Publish** button when you're ready.

### Step 4: Review & Publish

- Preview shows all details: media, caption, hashtags, platforms, schedule
- Click **"Publish Post"** to finalize
- Status updates to:
  - `published` (if posting now)
  - `scheduled` (if date-based)

---

## Settings Configuration

Access via **Settings** tab in Social Studio.

### General Settings

#### **Posts Per Day (Slots Per Day)**

- **What it does**: Controls how many slot numbers appear in the scheduler
- **Default**: 2 slots
- **Range**: 1-5 slots per day
- **Use Case**: Increase when adding more accounts or campaigns

**How to Change**:
1. Go to Settings → General Settings
2. Drag the slider to desired number (1-5)
3. Updates are saved automatically
4. New slot buttons appear immediately in Create Flow

**Example**:
- Set to 3 slots → Create Flow shows Slot 1, Slot 2, Slot 3
- All 3 slots are organizational labels for planning your day

#### **Default Timezone**

- Sets timezone for date calculations
- Options: PT, MT, CT, ET, UTC
- Affects "Today" and date comparisons

#### **Max Hashtags (AI Suggestions)**

- Limits how many hashtags AI suggests per post
- Range: 0-30 (default: 30)
- Prevents over-tagging

#### **Require Approval**

- Toggle ON to require manual approval before scheduled posts publish
- Toggle OFF for fully automated publishing (default)

### Connected Accounts

- View all linked social media accounts
- See status: Active, Pending, Disconnected
- Sync accounts manually with **"🔄 Sync Accounts"** button
- Disconnect/Remove accounts as needed

### Schedule Management

*(Legacy feature - now using day-based scheduling)*

- View posting slots (historical reference)
- Add/remove slots for future features

### Campaigns

- Create named campaigns with color coding
- Organize posts by theme/project
- Archive old campaigns

---

## Publishing Your Posts

### The Publish Button

The **"Publish"** button (⚡ lightning icon) in the Home view is how you send scheduled posts to your social platforms.

### When to Use It

- **Daily routine**: Check Social Studio, review today's posts, hit Publish
- **Peak engagement**: Publish when your audience is most active
- **Real-time response**: Stay online to engage with comments right after posting
- **Batch processing**: Publish multiple queued posts at once

### How It Works

1. Go to **Home** view
2. Click **"⚡ Publish"** button (top-right corner)
3. System finds all posts with:
   - `status = 'scheduled'`
   - `scheduled_at <= today`
4. Each post is sent to your connected platforms
5. Results banner shows:
   - ✅ **X posts published successfully**
   - ❌ **Y posts failed** (if any)

### Important Notes

- Only processes posts scheduled for **today or earlier**
- Future posts remain in queue untouched
- Failed posts require manual review (check Library for errors)
- You control the timing — nothing publishes without you

---

## Managing Your Content

### Home View Dashboard

- **Today's Posts**: All posts scheduled for today (by slot)
- **Attention Needed**: Drafts, failed posts, or errors
- **Quick Stats**: Total posts, success rate, platforms used

### Library View

Browse all your posts:

- **Filter by Status**: All, Scheduled, Published, Failed, Draft
- **Search**: By caption text or ID
- **Platform Filter**: Show only specific platforms
- **Date Range**: Narrow by schedule date

**Actions**:
- Click post to edit
- Delete posts (be careful!)
- Duplicate posts to reuse content

### Calendar View

Visual calendar showing:

- Scheduled posts by date
- Slot indicators (Slot 1, Slot 2, etc.)
- Platform icons
- Color-coded campaigns

**Navigation**:
- Arrow buttons to change months
- Click date to see all posts for that day
- Click post for quick preview

---

## Troubleshooting

### Posts Not Publishing

**Check**:
1. Post status is `scheduled` (not `draft`)
2. `scheduled_at` date is today or past
3. Social platform accounts are connected and active
4. Post for Me API credentials valid

**Solution**: Review error messages in Library view, reconnect accounts if needed

### AI Captions Not Working

**Common Errors**:

**"No AI voice profiles found"**
- You need to create at least one AI voice profile first
- Go to Admin → AI Voice Profiles → Create Profile
- Assign voice to social accounts

**"AI caption generation failed"**
- Check Gemini API key in environment variables
- Review error logs for rate limits
- Try again in a few minutes

### Slot Numbers Not Showing

**Cause**: Settings not loaded yet

**Solution**:
1. Go to Settings → General Settings
2. Verify "Posts Per Day" slider is visible
3. Refresh page if needed
4. CreateFlow should fetch settings on mount

### Duplicate Posts Publishing

**Cause**: Same slot used multiple times on same date

**Solution**:
- Check Calendar view for conflicts
- Use unique slot numbers for each post per day
- Delete extra scheduled posts if needed

### Can't Connect Social Account

**Check**:
1. Correct OAuth credentials in `.env` files
2. Callback URL matches platform settings
3. Account not already connected elsewhere
4. Platform API not experiencing downtime

**Solution**: Review platform-specific setup docs (SHOPIFY_AUTH_SETUP.md, etc.)

---

## Best Practices

### Planning Ahead

1. **Batch Create Posts**: Queue up a week's worth at once
2. **Use Campaigns**: Group related content for easy tracking
3. **Preview Calendar**: Check for conflicts or gaps
4. **Daily Check-In**: Review Home view and Publish when ready

### Content Strategy

- **Vary Slot Times**: Use different slots for different content types
  - Slot 1: Product posts
  - Slot 2: Engagement posts
- **Reuse Clips**: Browse "Unposted Only" to maximize library
- **AI Captions**: Save time with platform-optimized text
- **Campaigns**: Track performance by theme

### Maintenance

- **Weekly Review**: Check Library for failed posts
- **Monthly Audit**: Archive old campaigns
- **Settings Check**: Update slots_per_day as you scale
- **Account Sync**: Re-authorize accounts if tokens expire

---

## FAQs

**Q: Do posts publish automatically?**
A: No. You manually click the Publish button when you're ready. This gives you full control over timing.

**Q: What happens if I schedule 2 posts in Slot 1 on the same day?**
A: The latest one overwrites the slot. Check Calendar view to avoid conflicts.

**Q: Do slots publish in order (1, 2, 3)?**
A: All slots for the same date are processed together when you hit Publish. Slot numbers are organizational labels.

**Q: Can I cancel a scheduled post?**
A: Yes, go to Library → find post → Delete or change status to Draft.

**Q: How do I know if publishing worked?**
A: Check the success/failure banner after clicking Publish. Also review Library for post status updates.

**Q: Can I increase slots above 5?**
A: Currently limited to 5 in UI. Contact developer to adjust if needed.

**Q: What's the difference between "Post Now" and the Publish button?**
A:
- **Post Now** (in Create Flow): Creates AND publishes a new post immediately
- **Publish button** (on Home): Publishes all scheduled posts that are due

---

## Support

For technical issues or feature requests, contact the development team or review:

- `SHOPIFY_AUTH_SETUP.md` - Platform authentication
- `MONITORING_GUIDE.md` - System health checks
- `PRODUCTION_SETUP.md` - Deployment configuration

**Error Logs**: Check Sentry or Vercel logs for detailed error messages.

---

## Changelog

**v2.1 (January 2026)**
- Switched to manual publishing model (removed automatic midnight cron)
- Full control over when posts go live

**v2.0 (January 2026)**
- Switched from time-based to day-based scheduling
- Added configurable slots per day in Settings
- Implemented General Settings section
- Dynamic slot buttons in CreateFlow
- Improved AI caption error handling

**v1.0 (December 2025)**
- Initial release
- Time-based scheduling (deprecated)
- Multi-platform support

---

**Made with ❤️ by Odubo Team**
