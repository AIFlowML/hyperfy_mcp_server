export class World {
  entities: {
    player?: {
      data: {
        id: string;
        name: string;
      };
      setSessionAvatar: (url: string) => void;
      modify: (data: { name: string }) => void;
    };
    items: Map<string, unknown>;
  };
  
  chat: {
    add: (msg: unknown, broadcast?: boolean) => void;
    msgs: unknown[];
    listeners: Array<(msgs: unknown[]) => void>;
    subscribe: (callback: (msgs: unknown[]) => void) => void;
  };
  
  events: {
    emit: (event: string, data: unknown) => void;
  };
  
  network: {
    send: (type: string, data: unknown) => void;
    upload: (file: File) => Promise<void>;
    disconnect: () => Promise<void>;
    id?: string;
  };
  
  systems: unknown[];
  assetsUrl?: string;
  scripts?: {
    evaluate: (code: string) => unknown;
  };
  
  init: (config: unknown) => Promise<void>;
  destroy: () => void;
  on: (event: string, callback: (data?: unknown) => void) => void;
  off: (event: string) => void;
} 