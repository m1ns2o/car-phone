// <audio> 출력 — AudioContext를 경유하지 않는다.
// (Android Auto ducking 검증을 오염시키지 않기 위함)
export function attachRemoteAudio(el: HTMLAudioElement, stream: MediaStream) {
  el.srcObject = stream;
  el.autoplay = true;
  // playsInline은 iOS용. setSinkId는 호출하지 않음 (OS 라우팅에 맡김)
  el.setAttribute('playsinline', 'true');
  void el.play().catch(() => {
    // autoplay 차단 시 사용자 제스처 후 재시도 (UI에서 처리)
  });
}
