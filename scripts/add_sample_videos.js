import { queryDatabase } from '../src/lib/db.js';

const sampleVideos = [
  {
    title: "Odubo Studio Showreel",
    description: "A showcase of our creative work spanning music videos, short films, and artistic collaborations.",
    url: "/videos/showreel.mp4",
    poster_url: null,
    thumbnail: null,
    duration: "3:24",
    category: "Showreel",
    type: "Corporate",
    mood: "Professional",
    credits: "Directed by Odubo Studio",
  },
  {
    title: "Abstract Expressions",
    description: "An experimental visual piece exploring color, movement, and emotion through digital artistry.",
    url: "/videos/abstract.mp4",
    poster_url: null,
    thumbnail: null,
    duration: "2:15",
    category: "Art",
    type: "Experimental",
    mood: "Artistic",
    credits: "Visual Artist: Odubo Creative Team",
  },
  {
    title: "Behind the Scenes: Studio Sessions",
    description: "Get an inside look at how we create our musical masterpieces in the studio.",
    url: "/videos/bts-studio.mp4",
    poster_url: null,
    thumbnail: null,
    duration: "5:42",
    category: "Documentary",
    type: "Behind the Scenes",
    mood: "Informative",
    credits: "Producer: Odubo Music Division",
  },
  {
    title: "Midnight Chronicles",
    description: "A short narrative film exploring themes of isolation and connection in the digital age.",
    url: "/videos/midnight-chronicles.mp4",
    poster_url: null,
    thumbnail: null,
    duration: "12:30",
    category: "Narrative",
    type: "Short Film",
    mood: "Dramatic",
    credits: "Writer/Director: Odubo Film Unit",
  },
  {
    title: "Urban Rhythms",
    description: "A music video capturing the pulse of city life through dynamic visuals and compelling beats.",
    url: "/videos/urban-rhythms.mp4",
    poster_url: null,
    thumbnail: null,
    duration: "4:18",
    category: "Music",
    type: "Music Video",
    mood: "Energetic",
    credits: "Artist: Featured Artist, Director: Odubo Creative",
  }
];

async function addSampleVideos() {
  try {
    for (const video of sampleVideos) {
      await queryDatabase(`
        INSERT INTO videos (
          title, description, url, poster_url, thumbnail, duration, 
          category, type, mood, credits, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        video.title,
        video.description,
        video.url,
        video.poster_url,
        video.thumbnail,
        video.duration,
        video.category,
        video.type,
        video.mood,
        video.credits
      ]);
    }
    console.log('Sample videos added successfully!');
  } catch (error) {
    console.error('Error adding sample videos:', error);
  }
}

addSampleVideos();
