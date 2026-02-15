export type AuthSubject = {
  type: 'user' | 'service';
  id: string;
  scopes: string[];
  userId?: string | null;
  apiKeyId?: string;
};

export type AppBindings = {
  Variables: {
    authSubject?: AuthSubject;
  };
};

export const GRAPH_READ_SCOPE = 'graph:read';
