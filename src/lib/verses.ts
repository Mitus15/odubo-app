/**
 * Curated collection of Bible verses (Proverbs focus).
 * No external API needed — rotates based on day of year.
 * Free, fast, never fails.
 */

export interface VerseEntry {
  text: string;
  reference: string;
}

// Curated verses from Proverbs (and a few from other books for variety)
const VERSE_POOL: VerseEntry[] = [
  // Proverbs
  { text: "The fear of the Lord is the beginning of knowledge, but fools despise wisdom and instruction.", reference: "Proverbs 1:7" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.", reference: "Proverbs 3:5-6" },
  { text: "Honor the Lord with your wealth, with the firstfruits of all your crops; then your barns will be filled to overflowing, and your vats will brim over with new wine.", reference: "Proverbs 3:9-10" },
  { text: "Blessed are those who find wisdom, those who gain understanding, for she is more profitable than silver and yields better returns than gold.", reference: "Proverbs 3:13-14" },
  { text: "Above all else, guard your heart, for everything you do flows from it.", reference: "Proverbs 4:23" },
  { text: "The path of the righteous is like the morning sun, shining ever brighter till the full light of day.", reference: "Proverbs 4:18" },
  { text: "Drink water from your own cistern, running water from your own well.", reference: "Proverbs 5:15" },
  { text: "Go to the ant, you sluggard; consider its ways and be wise!", reference: "Proverbs 6:6" },
  { text: "For wisdom is more precious than rubies, and nothing you desire can compare with her.", reference: "Proverbs 8:11" },
  { text: "The fear of the Lord is the beginning of wisdom, and knowledge of the Holy One is understanding.", reference: "Proverbs 9:10" },
  { text: "When pride comes, then comes disgrace, but with humility comes wisdom.", reference: "Proverbs 11:2" },
  { text: "Anxiety weighs down the heart, but a kind word cheers it up.", reference: "Proverbs 12:25" },
  { text: "Hope deferred makes the heart sick, but a longing fulfilled is a tree of life.", reference: "Proverbs 13:12" },
  { text: "A gentle answer turns away wrath, but a harsh word stirs up anger.", reference: "Proverbs 15:1" },
  { text: "A cheerful heart is good medicine, but a crushed spirit dries up the bones.", reference: "Proverbs 17:22" },
  { text: "The name of the Lord is a fortified tower; the righteous run to it and are safe.", reference: "Proverbs 18:10" },
  { text: "Many are the plans in a person's heart, but it is the Lord's purpose that prevails.", reference: "Proverbs 19:21" },
  { text: "The human spirit can endure in sickness, but a crushed spirit who can bear?", reference: "Proverbs 18:14" },
  { text: "A person's steps are directed by the Lord. How then can anyone understand their own way?", reference: "Proverbs 20:24" },
  { text: "The Lord detests differing weights, and dishonest scales do not please him.", reference: "Proverbs 20:23" },
  { text: "Start children off on the way they should go, and even when they are old they will not turn from it.", reference: "Proverbs 22:6" },
  { text: "Rich and poor have this in common: The Lord is the Maker of them all.", reference: "Proverbs 22:2" },
  { text: "Do not boast about tomorrow, for you do not know what a day may bring.", reference: "Proverbs 27:1" },
  { text: "As iron sharpens iron, so one person sharpens another.", reference: "Proverbs 27:17" },
  { text: "Where there is no revelation, people cast off restraint; but blessed is the one who heeds wisdom's instruction.", reference: "Proverbs 29:18" },
  { text: "Speak up for those who cannot speak for themselves, for the rights of all who are destitute.", reference: "Proverbs 31:8" },
  { text: "Charm is deceptive, and beauty is fleeting; but a woman who fears the Lord is to be praised.", reference: "Proverbs 31:30" },
  { text: "The righteous care about the needs of their animals, but the kindest acts of the wicked are cruel.", reference: "Proverbs 12:10" },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", reference: "Proverbs 16:3" },
  { text: "A friend loves at all times, and a brother is born for a time of adversity.", reference: "Proverbs 17:17" },
  { text: "The tongue has the power of life and death, and those who love it will eat its fruit.", reference: "Proverbs 18:21" },
  { text: "Listen to advice and accept discipline, and at the end you will be counted among the wise.", reference: "Proverbs 19:20" },
  { text: "Whoever is patient has great understanding, but one who is quick-tempered displays folly.", reference: "Proverbs 14:29" },
  { text: "A heart at peace gives life to the body, but envy rots the bones.", reference: "Proverbs 14:30" },
  { text: "Better a little with the fear of the Lord than great wealth with turmoil.", reference: "Proverbs 15:16" },
  { text: "Pride goes before destruction, a haughty spirit before a fall.", reference: "Proverbs 16:18" },
  { text: "A good name is more desirable than great riches; to be esteemed is better than silver or gold.", reference: "Proverbs 22:1" },
  { text: "Do not say, 'I'll pay you back for this wrong!' Wait for the Lord, and he will avenge you.", reference: "Proverbs 20:22" },
  { text: "Like a city whose walls are broken through is a person who lacks self-control.", reference: "Proverbs 25:28" },
  { text: "The prudent see danger and take refuge, but the simple keep going and pay the penalty.", reference: "Proverbs 27:12" },
  { text: "The wicked flee though no one pursues, but the righteous are as bold as a lion.", reference: "Proverbs 28:1" },
  { text: "Whoever conceals their sins does not prosper, but the one who confesses and renounces them finds mercy.", reference: "Proverbs 28:13" },
  { text: "Where there is no vision, the people perish: but he that keepeth the law, happy is he.", reference: "Proverbs 29:18 (KJV)" },
  { text: "Every word of God is flawless; he is a shield to those who take refuge in him.", reference: "Proverbs 30:5" },
  { text: "She speaks with wisdom, and faithful instruction is on her tongue.", reference: "Proverbs 31:26" },
  // Psalms
  { text: "The Lord is my shepherd, I lack nothing. He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul.", reference: "Psalm 23:1-3" },
  { text: "Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth.", reference: "Psalm 46:10" },
  { text: "Create in me a pure heart, O God, and renew a steadfast spirit within me.", reference: "Psalm 51:10" },
  { text: "The heavens declare the glory of God; the skies proclaim the work of his hands.", reference: "Psalm 19:1" },
  { text: "Your word is a lamp for my feet, a light on my path.", reference: "Psalm 119:105" },
  { text: "This is the day the Lord has made; let us rejoice and be glad in it.", reference: "Psalm 118:24" },
  // Ecclesiastes
  { text: "To everything there is a season, and a time to every purpose under the heaven.", reference: "Ecclesiastes 3:1" },
  { text: "He has made everything beautiful in its time. He has also set eternity in the human heart.", reference: "Ecclesiastes 3:11" },
  // Isaiah
  { text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles.", reference: "Isaiah 40:31" },
  { text: "Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.", reference: "Isaiah 41:10" },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", reference: "Jeremiah 29:11" },
  // New Testament
  { text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", reference: "John 3:16" },
  { text: "I am the way and the truth and the life. No one comes to the Father except through me.", reference: "John 14:6" },
  { text: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.", reference: "John 14:27" },
  { text: "I can do all this through him who gives me strength.", reference: "Philippians 4:13" },
  { text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", reference: "Philippians 4:6" },
  { text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.", reference: "Romans 8:28" },
  { text: "Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you.", reference: "Ephesians 4:32" },
  { text: "For we walk by faith, not by sight.", reference: "2 Corinthians 5:7" },
  { text: "Let everything that has breath praise the Lord. Praise the Lord.", reference: "Psalm 150:6" },
  { text: "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you.", reference: "Numbers 6:24-25" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", reference: "Joshua 1:9" },
  { text: "But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.", reference: "Galatians 5:22-23" },
  { text: "Let the peace of Christ rule in your hearts... and be thankful.", reference: "Colossians 3:15" },
  { text: "The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning.", reference: "Lamentations 3:22-23" },
  { text: "Rejoice always, pray continually, give thanks in all circumstances; for this is God's will for you in Christ Jesus.", reference: "1 Thessalonians 5:16-18" },
  { text: "For by grace you have been saved through faith, and that not of yourselves; it is the gift of God.", reference: "Ephesians 2:8" },
  { text: "Therefore encourage one another and build each other up, just as in fact you are doing.", reference: "1 Thessalonians 5:11" },
  { text: "Cast all your anxiety on him because he cares for you.", reference: "1 Peter 5:7" },
  { text: "Jesus Christ is the same yesterday and today and forever.", reference: "Hebrews 13:8" },
  { text: "Now faith is confidence in what we hope for and assurance about what we do not see.", reference: "Hebrews 11:1" },
  { text: "Love is patient, love is kind. It does not envy, it does not boast, it is not proud.", reference: "1 Corinthians 13:4" },
  { text: "And now these three remain: faith, hope and love. But the greatest of these is love.", reference: "1 Corinthians 13:13" },
  { text: "Do everything in love.", reference: "1 Corinthians 16:14" },
  { text: "God is our refuge and strength, an ever-present help in trouble.", reference: "Psalm 46:1" },
  { text: "The Lord is good to those whose hope is in him, to the one who seeks him.", reference: "Lamentations 3:25" },
  { text: "Delight yourself in the Lord, and he will give you the desires of your heart.", reference: "Psalm 37:4" },
  { text: "The Lord is my light and my salvation—whom shall I fear?", reference: "Psalm 27:1" },
  { text: "Taste and see that the Lord is good; blessed is the one who takes refuge in him.", reference: "Psalm 34:8" },
  { text: "The Lord is near to all who call on him, to all who call on him in truth.", reference: "Psalm 145:18" },
];

/**
 * Get the verse of the day based on the current date.
 * Uses day-of-year to deterministically select a verse.
 * No API calls, no failures, completely free.
 */
export function getVerseOfTheDay(): VerseEntry {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  // Use day of year to pick a verse, wrapping around the pool
  const index = dayOfYear % VERSE_POOL.length;
  return VERSE_POOL[index];
}
