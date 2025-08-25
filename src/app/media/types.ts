export type Credit = {
  name: string;
  role: string;
};

export type Video = {
  id: number;
  title: string;
  description: string;
  url: string;
  poster_url: string;
  thumbnail: string;
  duration: string;
  category: string;
  is_public: boolean;
  type: "music video" | "short film" | "feature";
  mood: "outgoing" | "introspective" | "neutral";
  credits: Credit[];
  related_projects: string[];
  created_at?: string;
};
