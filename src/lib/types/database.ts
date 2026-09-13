export type GardenTheme = "forest" | "night" | "sea";
export type Visibility = "public" | "friends" | "private";
export type DiaryType = "text" | "drawing" | "voice";
export type ProgramStatus = "ongoing" | "completed";

// NOTE: these are `type` aliases, not `interface`s, on purpose. Supabase's
// generics check `Row/Insert/Update extends Record<string, unknown>` as a
// conditional-type constraint, and TypeScript only grants the implicit
// string index signature needed to pass that check to object-literal types
// - a plain `interface` never satisfies it, which silently collapses every
// table to `never` (inserts/updates/rpc calls all become untyped).
export type Profile = {
  id: string;
  nickname: string;
  bio: string;
  avatar_id: string;
  visibility: Visibility;
  xp: number;
  quest_done: boolean;
  garden_theme: GardenTheme;
  created_at: string;
  updated_at: string;
};

export type GardenItemRow = {
  id: string;
  user_id: string;
  item_key: string;
  emoji: string;
  left_pct: number;
  top_pct: number;
  font_size: number;
  created_at: string;
};

export type DiaryEntry = {
  id: string;
  user_id: string;
  entry_type: DiaryType;
  content: string;
  mood: number | null;
  created_at: string;
};

export type ProgramTemplate = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  keywords: string[];
  sort_order: number;
  is_active: boolean;
};

export type ProgramEnrollment = {
  id: string;
  user_id: string;
  program_id: string;
  status: ProgramStatus;
  progress: number;
  updated_at: string;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  emoji: string;
  gradient_start: string;
  gradient_end: string;
  like_count: number;
  created_at: string;
};

export type PostLike = {
  post_id: string;
  user_id: string;
  created_at: string;
};

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

export type MindCard = {
  id: string;
  post_id: string;
  sender_id: string;
  message: string;
  created_at: string;
};

type NoRelationships = { Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      } & NoRelationships;
      garden_items: {
        Row: GardenItemRow;
        Insert: Partial<GardenItemRow> & { user_id: string; item_key: string; emoji: string };
        Update: Partial<GardenItemRow>;
      } & NoRelationships;
      diary_entries: {
        Row: DiaryEntry;
        Insert: Partial<DiaryEntry> & { user_id: string };
        Update: Partial<DiaryEntry>;
      } & NoRelationships;
      program_templates: {
        Row: ProgramTemplate;
        Insert: Partial<ProgramTemplate>;
        Update: Partial<ProgramTemplate>;
      } & NoRelationships;
      program_enrollments: {
        Row: ProgramEnrollment;
        Insert: Partial<ProgramEnrollment> & { user_id: string; program_id: string };
        Update: Partial<ProgramEnrollment>;
      } & NoRelationships;
      community_posts: {
        Row: CommunityPost;
        Insert: Partial<CommunityPost> & { user_id: string; title: string };
        Update: Partial<CommunityPost>;
      } & NoRelationships;
      post_likes: {
        Row: PostLike;
        Insert: Partial<PostLike> & { post_id: string; user_id: string };
        Update: Partial<PostLike>;
      } & NoRelationships;
      post_comments: {
        Row: PostComment;
        Insert: Partial<PostComment> & { post_id: string; user_id: string; text: string };
        Update: Partial<PostComment>;
      } & NoRelationships;
      mind_cards: {
        Row: MindCard;
        Insert: Partial<MindCard> & { post_id: string; sender_id: string; message: string };
        Update: Partial<MindCard>;
      } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: {
      add_xp: {
        Args: { p_user_id: string; p_amount: number };
        Returns: void;
      };
    };
  };
};
