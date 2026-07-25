declare module 'plyr' {
  interface PlyrOptions {
    controls?: string[];
    settings?: string[];
    speed?: { selected: number; options: number[] };
    fullscreen?: { enabled: boolean; iosNative: boolean };
  }

  interface PlyrSource {
    type: string;
    sources: { src: string; type?: string }[];
  }

  class Plyr {
    constructor(element: HTMLElement | string, options?: PlyrOptions);
    source: PlyrSource;
    currentTime: number;
    paused: boolean;
    speed: number;
    play(): Promise<void>;
    pause(): void;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    destroy(): void;
  }

  export default Plyr;
}
