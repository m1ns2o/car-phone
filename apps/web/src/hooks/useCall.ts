import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus } from '@carphone/shared';
import type { SignalMessage } from '@carphone/shared';
import { wsUrlWithAuth } from '@carphone/api';
import {
  attachRemoteAudio,
  attachLocalTracks,
  collectStats,
  createPeerConnection,
  ensureLocalAudio,
  setMuted,
  type CallStats,
} from '@carphone/webrtc';
import { useWakeLock } from './useWakeLock';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export interface UseCallOpts {
  roomId: string;
  name: string;
  remoteAudio: React.RefObject<HTMLAudioElement>;
  inviteTo?: string; // 친구 호출 시 수신자 userId — 입장 후 CALL_INVITE 전송
  inviteFrom?: string; // 발신자 userId (수신자 기록용으로 전달)
}

export function useCall({ roomId, name, remoteAudio, inviteTo, inviteFrom }: UseCallOpts) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [peerJoined, setPeerJoined] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('-');
  const [iceState, setIceState] = useState<string>('-');
  const [muted, setMutedState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [seconds, setSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inviteTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const joinTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const connectedAt = useRef<number | null>(null);

  // WakeLock은 connected 동안만
  useWakeLock(status === 'connected');

  const log = useCallback((m: string) => {
    setLogs((prev) => [`${new Date().toLocaleTimeString()} ${m}`, ...prev].slice(0, 80));
    // eslint-disable-next-line no-console
    console.log('[call]', m);
  }, []);

  const send = useCallback((msg: SignalMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  // 통화 시간 타이머
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(() => {
      if (connectedAt.current) setSeconds(Math.floor((Date.now() - connectedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // getStats 폴링 (5초) — 안정성 검증용
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(async () => {
      if (pcRef.current) {
        const s = await collectStats(pcRef.current);
        setStats(s);
        log(`stats rtt=${s.rttMs?.toFixed(0) ?? '-'}ms jitter=${s.jitterMs?.toFixed(1) ?? '-'}ms lost=${s.packetsLost ?? 0}`);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [status, log]);

  const ensurePeer = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = createPeerConnection({
      onRemoteStream: (s) => {
        if (remoteAudio.current) attachRemoteAudio(remoteAudio.current, s);
        log('remote stream attached');
      },
      onConnectionState: (s) => {
        setConnectionState(s);
        log(`connectionState=${s}`);
        if (s === 'connected') {
          connectedAt.current = Date.now();
          setStatus('connected');
        } else if (s === 'connecting') {
          setStatus('connecting');
        } else if (s === 'disconnected') {
          setStatus('disconnected');
        } else if (s === 'failed') {
          setStatus('failed');
        } else if (s === 'closed') {
          setStatus('closed');
        }
        send({ t: 'CALL_STATE', roomId, state: s });
      },
      onIceState: (s) => {
        setIceState(s);
        log(`iceState=${s}`);
      },
      onIceCandidate: (c) => {
        send({
          t: 'ICE_CANDIDATE',
          roomId,
          candidate: c.candidate,
          sdpMid: c.sdpMid,
          sdpMLineIndex: c.sdpMLineIndex,
        });
      },
    });
    if (localRef.current) attachLocalTracks(pc, localRef.current);
    pcRef.current = pc;
    return pc;
  }, [log, remoteAudio, roomId, send]);

  // 초기 진입: 마이크 + WS + ROOM_JOIN
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        setStatus('joining');
        const stream = await ensureLocalAudio();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        log('mic ok: ' + stream.getAudioTracks().map((t) => t.label).join(','));

        const ws = new WebSocket(wsUrlWithAuth());
        wsRef.current = ws;
        // Cloudflare 등 프록시의 유휴 타임아웃(≈100s) 방지: 25s 간격 heartbeat
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ t: 'PING' }));
            } catch {
              /* ignore */
            }
          }
        }, 25000);

        let peerSeen = false;
        let inviteTimer: ReturnType<typeof setInterval> | undefined;
        // ROOM_JOIN 유실 대비: 상대 입장 확인 전까지 4초 간격 재전송 (서버 Set이라 멱등)
        const joinTimer = setInterval(() => {
          if (!peerSeen && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ t: 'ROOM_JOIN', roomId, name } satisfies SignalMessage));
            } catch {
              /* ignore */
            }
          }
        }, 4000);
        joinTimerRef.current = joinTimer;
        ws.onopen = () => {
          ws.send(JSON.stringify({ t: 'ROOM_JOIN', roomId, name } satisfies SignalMessage));
          setStatus('waiting-peer');
          log('ws open, joined ' + roomId);
          if (inviteTo) {
            // 수신자가 뒤늦게 온라인이 돼도 받을 수 있게 입장 전까지 4초 간격 재전송
            const sendInvite = () => {
              if (peerSeen) return;
              try {
                ws.send(
                  JSON.stringify({
                    t: 'CALL_INVITE',
                    roomId,
                    toUserId: inviteTo,
                    from: name,
                    ...(inviteFrom ? { fromUserId: inviteFrom } : {}),
                  } satisfies SignalMessage),
                );
              } catch {
                /* ignore */
              }
            };
            sendInvite();
            log('invite sent to ' + inviteTo);
            inviteTimer = setInterval(sendInvite, 4000);
            inviteTimerRef.current = inviteTimer;
          }
        };
        const stopInviteRetry = () => {
          peerSeen = true;
          if (inviteTimer) clearInterval(inviteTimer);
          clearInterval(joinTimer);
        };
        ws.onclose = () => log('ws closed');
        ws.onerror = () => {
          setError('시그널링 연결 실패 (서버/터널 확인)');
          log('ws error');
        };
        ws.onmessage = async (ev) => {
          let msg: SignalMessage;
          try {
            msg = JSON.parse(ev.data as string) as SignalMessage;
          } catch {
            return;
          }
          if (msg.t === 'ROOM_PEER_JOINED') {
            setPeerJoined(true);
            stopInviteRetry();
            log('peer joined — 통화 시작 버튼을 누르세요');
          } else if (msg.t === 'ROOM_PEER_LEFT') {
            setPeerJoined(false);
            log('peer left');
          } else if (msg.t === 'SDP_OFFER' && msg.roomId === roomId) {
            log('got OFFER → ANSWER 생성');
            const pc = ensurePeer();
            await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ t: 'SDP_ANSWER', roomId, sdp: answer.sdp ?? '' });
            setStatus('connecting');
          } else if (msg.t === 'SDP_ANSWER' && msg.roomId === roomId) {
            log('got ANSWER');
            await pcRef.current?.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          } else if (msg.t === 'ICE_CANDIDATE' && msg.roomId === roomId) {
            try {
              await pcRef.current?.addIceCandidate({
                candidate: msg.candidate,
                sdpMid: msg.sdpMid,
                sdpMLineIndex: msg.sdpMLineIndex,
              });
            } catch (e) {
              log('addIce failed ' + String(e));
            }
          } else if (msg.t === 'CALL_END') {
            log('peer hung up');
            hangup(false);
          } else if (msg.t === 'ERROR') {
            log('server: ' + (msg as { message: string }).message);
          }
        };
      } catch (e) {
        setError('마이크 권한이 필요합니다 (HTTPS + 브라우저 허용 확인)');
        setStatus('failed');
        log('getUserMedia failed: ' + String(e));
      }
    }
    void boot();
    return () => {
      cancelled = true;
      if (inviteTimerRef.current) clearInterval(inviteTimerRef.current);
      if (joinTimerRef.current) clearInterval(joinTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      wsRef.current?.close();
      pcRef.current?.close();
      localRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const startCall = useCallback(async () => {
    try {
      setStatus('offering');
      const pc = ensurePeer();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ t: 'SDP_OFFER', roomId, sdp: offer.sdp ?? '' });
      send({ t: 'CALL_REQUEST', roomId, from: name });
      setStatus('connecting');
      log('sent OFFER');
    } catch (e) {
      setError('통화 시작 실패: ' + String(e));
      setStatus('failed');
    }
  }, [ensurePeer, log, name, roomId, send]);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      setMuted(localRef.current, !m);
      return !m;
    });
  }, []);

  const restartIce = useCallback(async () => {
    try {
      const pc = ensurePeer();
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      send({ t: 'SDP_OFFER', roomId, sdp: offer.sdp ?? '' });
      log('ICE restart offer sent');
    } catch (e) {
      log('ICE restart failed: ' + String(e));
    }
  }, [ensurePeer, log, roomId, send]);

  const hangup = useCallback(
    (notify = true) => {
      if (notify) {
        try {
          send({ t: 'CALL_END', roomId });
        } catch {
          /* ignore */
        }
      }
      pcRef.current?.close();
      pcRef.current = null;
      connectedAt.current = null;
      setStatus('closed');
      log('hung up');
    },
    [log, roomId, send],
  );

  return {
    status,
    peerJoined,
    connectionState,
    iceState,
    muted,
    error,
    logs,
    stats,
    time: fmt(seconds),
    seconds,
    startCall,
    toggleMute,
    restartIce,
    hangup,
  };
}
