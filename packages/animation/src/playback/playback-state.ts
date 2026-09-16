export interface PlaybackState {
  time: number;
  playing: boolean;
  speed: number;
}

export function createPlaybackState(): PlaybackState {
  return { time: 0, playing: false, speed: 1 };
}
