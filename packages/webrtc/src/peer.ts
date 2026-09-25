import { buildIceConfig } from './iceConfig.js';

export interface PeerCallbacks {
  onRemoteStream: (s: MediaStream) => void;
  onConnectionState: (s: RTCPeerConnectionState) => void;
  onIceState: (s: RTCIceConnectionState) => void;
  onIceCandidate: (c: RTCIceCandidate) => void;
}

export function createPeerConnection(cb: PeerCallbacks): RTCPeerConnection {
  const pc = new RTCPeerConnection(buildIceConfig());

  pc.ontrack = (e) => {
    const [stream] = e.streams;
    if (stream) cb.onRemoteStream(stream);
  };
  pc.onconnectionstatechange = () => cb.onConnectionState(pc.connectionState);
  pc.oniceconnectionstatechange = () => cb.onIceState(pc.iceConnectionState);
  pc.onicecandidate = (e) => {
    if (e.candidate) cb.onIceCandidate(e.candidate);
  };
  return pc;
}

export async function ensureLocalAudio(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
}

export function attachLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
  for (const track of stream.getAudioTracks()) {
    pc.addTrack(track, stream);
  }
}

export function setMuted(stream: MediaStream | null, muted: boolean) {
  stream?.getAudioTracks().forEach((t) => {
    t.enabled = !muted;
  });
}
