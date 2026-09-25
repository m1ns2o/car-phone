import Foundation

// WebRTC 피어 추상화. GoogleWebRTC 패키지 연동 시 RealPeer로 교체.
// (SPM 바이너리 추가 전까지 Stub으로 시그널링·UI 검증)
protocol PeerProvider: AnyObject {
  var onLocalSDP: ((String) -> Void)? { get set }      // offer/answer 생성 시
  var onCandidate: ((String) -> Void)? { get set }     // ICE candidate JSON
  var onConnected: (() -> Void)? { get set }
  var onRemoteAudio: (() -> Void)? { get set }
  var onFailed: (() -> Void)? { get set }
  func startAsCaller()
  func handleAnswer(sdp: String)
  func handleOffer(sdp: String)
  func handleCandidate(_ json: String)
  func setMuted(_ muted: Bool)
  func restartIce()
  func close()
}

final class StubPeerProvider: PeerProvider {
  var onLocalSDP: ((String) -> Void)?
  var onCandidate: ((String) -> Void)?
  var onConnected: (() -> Void)?
  var onRemoteAudio: (() -> Void)?
  var onFailed: (() -> Void)?
  func startAsCaller() {}
  func handleAnswer(sdp: String) {}
  func handleOffer(sdp: String) {}
  func handleCandidate(_ json: String) {}
  func setMuted(_ muted: Bool) {}
  func restartIce() {}
  func close() {}
}
