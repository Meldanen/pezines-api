export interface HandlerResponse<T> {
  status: 200 | 400 | 404 | 503;
  body: T;
}

export interface ErrorBody {
  error: string;
  // /prices/cheapest returns the available fuel types when an unknown one is requested.
  available?: string[];
}
