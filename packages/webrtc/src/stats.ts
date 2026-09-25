export interface CallStats {
  at: number;
  rttMs?: number;
  jitterMs?: number;
  packetsLost?: number;
  packetsReceived?: number;
  bytesReceived?: number;
}

export async function collectStats(pc: RTCPeerConnection): Promise<CallStats> {
  const out: CallStats = { at: Date.now() };
  try {
    const stats = await pc.getStats();
    stats.forEach((r: RTCStatsReport & Record<string, unknown>) => {
      if (r.type === 'inbound-rtp' && (r as { kind?: string }).kind === 'audio') {
        const rec = r as unknown as Record<string, number>;
        if (typeof rec.jitter === 'number') out.jitterMs = rec.jitter * 1000;
        if (typeof rec.packetsLost === 'number') out.packetsLost = rec.packetsLost;
        if (typeof rec.packetsReceived === 'number') out.packetsReceived = rec.packetsReceived;
        if (typeof rec.bytesReceived === 'number') out.bytesReceived = rec.bytesReceived;
      }
      if (r.type === 'candidate-pair' && (r as { nominated?: boolean }).nominated) {
        const rec = r as unknown as Record<string, number>;
        if (typeof rec.currentRoundTripTime === 'number') out.rttMs = rec.currentRoundTripTime * 1000;
      }
    });
  } catch {
    // 무시 (통화 우선)
  }
  return out;
}
