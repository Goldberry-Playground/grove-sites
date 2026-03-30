export interface GhostConfig {
  ghostUrl: string;
  contentKey: string;
  version?: string;
}

export interface Author {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  profileImage: string | null;
  url: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface Post {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string | null;
  featureImage: string | null;
  published_at: string;
  updated_at: string;
  authors: Author[];
  tags: Tag[];
  reading_time: number;
}

export interface Page {
  id: string;
  uuid: string;
  title: string;
  slug: string;
  html: string;
  featureImage: string | null;
  published_at: string;
  updated_at: string;
}

export interface GhostClient {
  posts: {
    list(params?: { limit?: number; page?: number; filter?: string; include?: string }): Promise<Post[]>;
    get(slug: string): Promise<Post>;
  };
  pages: {
    get(slug: string): Promise<Page>;
  };
  authors: {
    list(params?: { limit?: number }): Promise<Author[]>;
  };
}
