export interface NormalizedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface NormalizedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  error?: string;
}

export interface HttpTransport {
  send(request: NormalizedRequest): Promise<NormalizedResponse>;
}
