import Foundation
import Combine

enum CallStatus: String {
  case idle, joining, waitingPeer = "waiting-peer", connecting, connected, failed
}

// 웹 useCall.ts와 동일한 상태머신
final class CallViewModel: ObservableObject, SignalingDelegate {
  @Published var status: CallStatus = .idle
  @Published var peerName: String?
  @Published var muted = false
  @Published var seconds = 0
  @Published var logs: [String] = []
  @Published var error: String?

  let roomId: String
  let name: String
  private let inviteTo: String?
  private let inviteFrom: String?
  private let peerUserId: String?
  private var signaling: SignalingClient?
  private var peer: PeerProvider?
  private var timer: Timer?

  init(roomId: String, name: String, inviteTo: String? = nil, inviteFrom: String? = nil, peerUserId: String? = nil) {
    self.roomId = roomId; self.name = name
    self.inviteTo = inviteTo; self.inviteFrom = inviteFrom; self.peerUserId = peerUserId
  }

  var inviteURL: String { "https://carphone-web.pages.dev/call/\(roomId)" }

  func start() {
    guard status == .idle else { return }
    status = .joining
    log("joining \(roomId) as \(name)")
    do {
      try CallAudio.configure()
      log("audio session: playAndRecord/voiceChat (media path)")
    } catch {
      self.error = "오디오 세션 실패: \(error.localizedDescription)"
      log("audio session failed")
    }
    let sig = SignalingClient(roomId: roomId, name: name, inviteTo: inviteTo, inviteFrom: inviteFrom)
    sig.delegate = self
    signaling = sig
    let p = StubPeerProvider()
    p.onLocalSDP = { [weak self] sdp in self?.signaling?.sendOffer(sdp: sdp) }
    p.onCandidate = { [weak self] json in self?.signaling?.sendCandidate(json) }
    p.onConnected = { [weak self] in self?.onConnected() }
    p.onFailed = { [weak self] in self?.onFailed() }
    peer = p
    sig.connect()
    status = .waitingPeer
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self, self.status == .connected else { return }
      self.seconds += 1
    }
  }

  func beginCall() {
    guard status == .waitingPeer else { return }
    status = .connecting
    log("sending offer… (WebRTC 연동 후 실제 SDP)")
    peer?.startAsCaller()
  }

  func toggleMute() {
    muted.toggle()
    peer?.setMuted(muted)
    log(muted ? "muted" : "unmuted")
  }

  func leave() {
    log("leave")
    signaling?.disconnect()
    peer?.close()
    try? CallAudio.teardown()
    timer?.invalidate()
    status = .idle
  }

  // MARK: - SignalingDelegate
  func signalingDidOpen() { log("ws open") }
  func signalingPeerJoined(name: String?) {
    signaling?.peerDidJoin()
    peerName = name
    log("peer joined: \(name ?? "?") — 통화 시작 가능")
  }
  func signalingGotOffer(sdp: String) { log("got offer"); peer?.handleOffer(sdp: sdp) }
  func signalingGotAnswer(sdp: String) { log("got answer"); peer?.handleAnswer(sdp: sdp) }
  func signalingGotCandidate(_ json: String) { peer?.handleCandidate(json) }
  func signalingInviteReceived(roomId: String, from: String, fromUserId: String?) {
    log("invite from \(from)")
  }
  func signalingClosed() { log("ws closed") }
  func signalingError(_ message: String) { log("ERR \(message)") }

  private func onConnected() {
    status = .connected
    log("connected — remote audio attached")
  }

  private func onFailed() {
    status = .failed
    log("connection failed")
  }

  private func log(_ s: String) {
    let f = DateFormatter(); f.dateFormat = "HH:mm:ss"
    logs.append("\(f.string(from: Date())) \(s)")
  }
}
