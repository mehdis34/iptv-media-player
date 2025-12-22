export type XtreamCredentials = {
  host: string;
  username: string;
  password: string;
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
};
