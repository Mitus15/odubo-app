'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface VoiceProfile {
  id: number;
  name: string;
  is_active: number;
  tone_description: string | null;
  custom_instructions: string | null;
  banned_words: string | null;
  required_patterns: string | null;
  instagram_style: string | null;
  tiktok_style: string | null;
  youtube_style: string | null;
  max_emojis: number;
  max_hashtags: number;
  prefer_lowercase: number;
  created_at: string;
  updated_at: string;
}

interface TrainingExample {
  id: number;
  profile_id: number;
  content: string;
  platform: string | null;
  rating: 'perfect' | 'good' | 'avoid';
  source: string | null;
  notes: string | null;
  created_at: string;
}

type TabType = 'voice' | 'examples' | 'test';

export default function AIStudioPage() {
  const [activeTab, setActiveTab] = useState<TabType>('voice');
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<VoiceProfile | null>(null);
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Voice tab state
  const [toneDescription, setToneDescription] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [bannedWords, setBannedWords] = useState('');
  const [maxEmojis, setMaxEmojis] = useState(1);
  const [maxHashtags, setMaxHashtags] = useState(7);
  const [preferLowercase, setPreferLowercase] = useState(true);
  const [instagramStyle, setInstagramStyle] = useState('');
  const [tiktokStyle, setTiktokStyle] = useState('');
  const [youtubeStyle, setYoutubeStyle] = useState('');

  // Examples tab state
  const [newExampleContent, setNewExampleContent] = useState('');
  const [newExamplePlatform, setNewExamplePlatform] = useState<string>('');
  const [newExampleRating, setNewExampleRating] = useState<'perfect' | 'good' | 'avoid'>('perfect');

  // Test tab state
  const [testPrompt, setTestPrompt] = useState('');
  const [testPlatform, setTestPlatform] = useState('instagram');
  const [testResults, setTestResults] = useState<{ captions: string[], hashtags: string[] } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/ai-studio/profiles', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
        if (data.activeProfile) {
          setActiveProfile(data.activeProfile);
          loadProfileIntoState(data.activeProfile);
        }
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load profile data into state
  const loadProfileIntoState = (profile: VoiceProfile) => {
    setToneDescription(profile.tone_description || '');
    setCustomInstructions(profile.custom_instructions || '');
    setBannedWords(profile.banned_words ? JSON.parse(profile.banned_words).join(', ') : '');
    setMaxEmojis(profile.max_emojis || 1);
    setMaxHashtags(profile.max_hashtags || 7);
    setPreferLowercase(profile.prefer_lowercase === 1);
    setInstagramStyle(profile.instagram_style || '');
    setTiktokStyle(profile.tiktok_style || '');
    setYoutubeStyle(profile.youtube_style || '');
  };

  // Fetch examples
  const fetchExamples = useCallback(async () => {
    if (!activeProfile) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/ai-studio/examples?profile_id=${activeProfile.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setExamples(data.examples || []);
      }
    } catch (error) {
      console.error('Error fetching examples:', error);
    }
  }, [activeProfile]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (activeTab === 'examples') {
      fetchExamples();
    }
  }, [activeTab, fetchExamples]);

  // Save profile
  const handleSaveProfile = async () => {
    if (!activeProfile) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/ai-studio/profiles', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          id: activeProfile.id,
          tone_description: toneDescription || null,
          custom_instructions: customInstructions || null,
          banned_words: bannedWords ? bannedWords.split(',').map(w => w.trim()).filter(Boolean) : null,
          max_emojis: maxEmojis,
          max_hashtags: maxHashtags,
          prefer_lowercase: preferLowercase ? 1 : 0,
          instagram_style: instagramStyle || null,
          tiktok_style: tiktokStyle || null,
          youtube_style: youtubeStyle || null,
        }),
      });

      if (res.ok) {
        setSaveMessage('Saved!');
        setTimeout(() => setSaveMessage(null), 2000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveMessage('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Add example
  const handleAddExample = async () => {
    if (!activeProfile || !newExampleContent.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/ai-studio/examples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          profile_id: activeProfile.id,
          content: newExampleContent.trim(),
          platform: newExamplePlatform || null,
          rating: newExampleRating,
          source: 'user_written',
        }),
      });

      if (res.ok) {
        setNewExampleContent('');
        fetchExamples();
      }
    } catch (error) {
      console.error('Error adding example:', error);
    }
  };

  // Delete example
  const handleDeleteExample = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/admin/ai-studio/examples?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      fetchExamples();
    } catch (error) {
      console.error('Error deleting example:', error);
    }
  };

  // Test generation
  const handleTest = async () => {
    setIsTesting(true);
    setTestResults(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/ai-studio/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          profile_id: activeProfile?.id,
          test_prompt: testPrompt,
          platform: testPlatform,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTestResults({
          captions: data.captions || [],
          hashtags: data.hashtags || [],
        });
      }
    } catch (error) {
      console.error('Error testing:', error);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Loading AI Studio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-white/60 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-light tracking-wide">AI Studio</h1>
            </div>
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className={`text-sm ${saveMessage === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>
                  {saveMessage}
                </span>
              )}
              <button
                onClick={handleSaveProfile}
                disabled={isSaving || activeTab !== 'voice'}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {(['voice', 'examples', 'test'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab === 'voice' ? 'Voice' : tab === 'examples' ? 'Examples' : 'Test'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'voice' && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Tone Description */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-medium mb-2">Describe Your Voice</h3>
                <p className="text-white/60 text-sm mb-4">
                  Write in your own words how you want captions to sound. Be specific about your style.
                </p>
                <textarea
                  value={toneDescription}
                  onChange={(e) => setToneDescription(e.target.value)}
                  placeholder="artistic. minimal. poetic but accessible. i let the art speak..."
                  className="w-full h-32 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none resize-none"
                />
              </div>

              {/* Custom Instructions */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-medium mb-2">Custom Instructions</h3>
                <p className="text-white/60 text-sm mb-4">
                  Any additional instructions for the AI when generating captions.
                </p>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="never explain the content, let it speak for itself..."
                  className="w-full h-24 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none resize-none"
                />
              </div>

              {/* Generation Limits */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-medium mb-4">Generation Limits</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm text-white/60 block mb-2">Max Emojis</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={maxEmojis}
                      onChange={(e) => setMaxEmojis(Number(e.target.value))}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 block mb-2">Max Hashtags</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={maxHashtags}
                      onChange={(e) => setMaxHashtags(Number(e.target.value))}
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 block mb-2">Prefer Lowercase</label>
                    <button
                      onClick={() => setPreferLowercase(!preferLowercase)}
                      className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                        preferLowercase
                          ? 'bg-white/20 border-white/40 text-white'
                          : 'bg-black/50 border-white/20 text-white/60'
                      }`}
                    >
                      {preferLowercase ? 'Yes' : 'No'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Banned Words */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-medium mb-2">Banned Words</h3>
                <p className="text-white/60 text-sm mb-4">
                  Words or phrases the AI should never use (comma-separated).
                </p>
                <input
                  type="text"
                  value={bannedWords}
                  onChange={(e) => setBannedWords(e.target.value)}
                  placeholder="amazing, incredible, don't miss, link in bio..."
                  className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
                />
              </div>

              {/* Platform-Specific Styles */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-medium mb-4">Platform Styles</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/60 block mb-2">Instagram</label>
                    <input
                      type="text"
                      value={instagramStyle}
                      onChange={(e) => setInstagramStyle(e.target.value)}
                      placeholder="1-2 sentences, minimal, slightly longer allowed..."
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 block mb-2">TikTok</label>
                    <input
                      type="text"
                      value={tiktokStyle}
                      onChange={(e) => setTiktokStyle(e.target.value)}
                      placeholder="ultra short, one line, lowercase..."
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 block mb-2">YouTube</label>
                    <input
                      type="text"
                      value={youtubeStyle}
                      onChange={(e) => setYoutubeStyle(e.target.value)}
                      placeholder="brief but discoverable, SEO-friendly..."
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'examples' && (
            <motion.div
              key="examples"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Add new example */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-medium mb-4">Add Training Example</h3>
                <div className="space-y-4">
                  <textarea
                    value={newExampleContent}
                    onChange={(e) => setNewExampleContent(e.target.value)}
                    placeholder="Enter an example caption you've written or love..."
                    className="w-full h-24 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none resize-none"
                  />
                  <div className="flex gap-4">
                    <select
                      value={newExamplePlatform}
                      onChange={(e) => setNewExamplePlatform(e.target.value)}
                      className="bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                    >
                      <option value="">All platforms</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                    </select>
                    <select
                      value={newExampleRating}
                      onChange={(e) => setNewExampleRating(e.target.value as 'perfect' | 'good' | 'avoid')}
                      className="bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                    >
                      <option value="perfect">Perfect (train on this)</option>
                      <option value="good">Good</option>
                      <option value="avoid">Avoid (never write like this)</option>
                    </select>
                    <button
                      onClick={handleAddExample}
                      disabled={!newExampleContent.trim()}
                      className="px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Examples list */}
              <div className="space-y-3">
                {examples.map((example) => (
                  <div
                    key={example.id}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-start gap-4"
                  >
                    <div className="flex-1">
                      <p className="text-white">{example.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          example.rating === 'perfect' ? 'bg-green-500/20 text-green-400' :
                          example.rating === 'good' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {example.rating}
                        </span>
                        {example.platform && (
                          <span className="text-xs px-2 py-1 rounded bg-white/10 text-white/60">
                            {example.platform}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteExample(example.id)}
                      className="text-white/40 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}

                {examples.length === 0 && (
                  <div className="text-center text-white/40 py-12">
                    No training examples yet. Add some captions you love!
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'test' && (
            <motion.div
              key="test"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Test input */}
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-medium mb-4">Test Your Voice</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/60 block mb-2">What's the content about?</label>
                    <input
                      type="text"
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="a new song release, behind the scenes footage, etc..."
                      className="w-full bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-4">
                    <select
                      value={testPlatform}
                      onChange={(e) => setTestPlatform(e.target.value)}
                      className="bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:border-white/40 focus:outline-none"
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="youtube">YouTube</option>
                    </select>
                    <button
                      onClick={handleTest}
                      disabled={isTesting || !testPrompt.trim()}
                      className="flex-1 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {isTesting ? 'Generating...' : 'Generate Captions'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Test results */}
              {testResults && (
                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h3 className="text-lg font-medium mb-4">Results</h3>
                  <div className="space-y-4">
                    {testResults.captions.map((caption, i) => (
                      <div key={i} className="bg-black/50 rounded-lg p-4 border border-white/10">
                        <p className="text-white">{caption}</p>
                        <div className="flex gap-2 mt-3">
                          <button className="text-xs px-3 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors">
                            👍 Good
                          </button>
                          <button className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                            👎 Bad
                          </button>
                          <button className="text-xs px-3 py-1 rounded bg-white/10 text-white/60 hover:bg-white/20 transition-colors">
                            Copy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {testResults.hashtags.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm text-white/60 mb-2">Hashtags</h4>
                      <p className="text-white/80">{testResults.hashtags.join(' ')}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
