export type XtreamCredentials = {
  host: string;
  username: string;
  password: string;
  profileName: string;
  profileAvatarUrl: string;
};

export type XtreamProfile = XtreamCredentials & {
  id: string;
  createdAt: number;
};

export type FavoriteItem = {
  id: number;
  type: 'movie' | 'series' | 'tv';
  addedAt: number;
};

export type ResumeItem = {
  id: number;
  type: 'movie' | 'series' | 'tv';
  positionSec: number;
  durationSec: number;
  updatedAt: number;
  completed: boolean;
  title?: string;
  image?: string;
  seriesId?: number;
  season?: number;
  episodeTitle?: string;
};

export type XtreamCategory = {
  category_id: string;
  category_name: string;
  parent_id?: number;
};

export type XtreamStream = {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string;
  stream_type?: string;
  epg_channel_id?: string;
  epg_id?: string;
};

export type XtreamVod = {
  stream_id: number;
  name: string;
  stream_icon?: string;
  cover?: string;
  category_id?: string;
  added?: string | number;
  container_extension?: string;
};

export type XtreamVodInfo = {
  info?: {
    name?: string;
    plot?: string;
    description?: string;
    genre?: string;
    rating?: string | number;
    releasedate?: string;
    releaseDate?: string;
    duration?: string;
    episode_run_time?: string;
    director?: string;
    cast?: string;
    actors?: string;
    cover_big?: string;
    movie_image?: string;
    backdrop_path?: string[];
    trailer?: string;
    youtube_trailer?: string;
  };
  movie_data?: {
    stream_id?: number;
    name?: string;
    category_id?: string;
    container_extension?: string;
    added?: string | number;
  };
};

export type XtreamSeries = {
  series_id: number;
  name: string;
  cover?: string;
  backdrop_path?: string[];
  category_id?: string;
  added?: string | number;
};

export type XtreamEpisode = {
  id: number;
  title?: string;
  name?: string;
  episode_num?: number;
  container_extension?: string;
  info?: {
    duration?: string;
    plot?: string;
    movie_image?: string;
    cover_big?: string;
    backdrop_path?: string[];
  };
};

export type XtreamSeriesInfo = {
  info?: {
    name?: string;
    plot?: string;
    description?: string;
    genre?: string;
    rating?: string | number;
    releaseDate?: string;
    releasedate?: string;
    cast?: string;
    actors?: string;
    cover?: string;
    backdrop_path?: string[];
    trailer?: string;
    youtube_trailer?: string;
  };
  seasons?: Array<{ season_number?: number; name?: string }>;
  episodes?: Record<string, XtreamEpisode[]>;
  series?: {
    series_id?: number;
    category_id?: string;
  };
};

export type XtreamEpgListing = {
  id?: string | number;
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  start_timestamp?: string | number;
  stop_timestamp?: string | number;
  epg_id?: string | number;
  now_playing?: boolean;
  channel_id?: string | number;
  category?: string;
};

export type XtreamAccountInfo = {
  user_info?: {
    username?: string;
    status?: string;
    exp_date?: string | number;
    created_at?: string | number;
    is_trial?: string | number;
    active_cons?: string | number;
    max_connections?: string | number;
    allowed_output_formats?: string[];
    message?: string;
  };
  server_info?: {
    url?: string;
    port?: string | number;
    https_port?: string | number;
    server_protocol?: string;
    timezone?: string;
    time_now?: string;
    timestamp_now?: string | number;
  };
};
