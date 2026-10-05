export type GardenTheme = "forest" | "night" | "sea";
export type Visibility = "public" | "friends" | "private";
export type DiaryType = "text" | "drawing" | "voice" | "record";
export type UserRole = "participant" | "therapist";
export type MaterialKind = "mind_card" | "masterpiece" | "mandala" | "activity" | "etc";
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
  role: UserRole;
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
  image_path: string | null;
  body: string;
  image_source: "drawn" | "uploaded" | null;
  exhibit_group_id: string | null;
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

export type Group = {
  id: string;
  facilitator_id: string;
  title: string;
  description: string;
  status: "active" | "ended";
  invite_code: string;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  status: "pending" | "accepted" | "rejected";
  joined_at: string | null;
  created_at: string;
};

export type ProgramSession = {
  id: string;
  group_id: string;
  session_no: number;
  title: string;
  description: string;
  scheduled_at: string | null;
  zoom_url: string | null;
  created_at: string;
};

export type SessionMaterial = {
  id: string;
  session_id: string;
  kind: MaterialKind;
  title: string;
  file_path: string;
  mime_type: string;
  created_at: string;
};

export type MoodCheck = {
  id: string;
  user_id: string;
  answers: number[];
  score: number;
  recommended: string;
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
      groups: {
        Row: Group;
        Insert: Partial<Group> & { facilitator_id: string; title: string };
        Update: Partial<Group>;
      } & NoRelationships;
      group_members: {
        Row: GroupMember;
        Insert: Partial<GroupMember> & { group_id: string; user_id: string };
        Update: Partial<GroupMember>;
      } & NoRelationships;
      program_sessions: {
        Row: ProgramSession;
        Insert: Partial<ProgramSession> & { group_id: string; session_no: number; title: string };
        Update: Partial<ProgramSession>;
      } & NoRelationships;
      session_materials: {
        Row: SessionMaterial;
        Insert: Partial<SessionMaterial> & { session_id: string; title: string; file_path: string };
        Update: Partial<SessionMaterial>;
      } & NoRelationships;
      mood_checks: {
        Row: MoodCheck;
        Insert: Partial<MoodCheck> & { user_id: string; answers: number[]; score: number };
        Update: Partial<MoodCheck>;
      } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: {
      add_xp: {
        Args: { p_user_id: string; p_amount: number };
        Returns: void;
      };
      join_group_by_code: {
        Args: { p_code: string };
        Returns: string;
      };
    };
  };
};
