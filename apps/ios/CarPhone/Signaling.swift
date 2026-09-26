import Foundation

// WebSocket 시그널링 클라이언트 (웹 useCall.ts와 동일 프로토콜)
protocol SignalingDelegate: AnyObject {
  func signalingDidOpen()
  func signalingPeerJoined(name: String?)
  func signalingGotOffer(sdp: String)
  func signalingGotAnswer(sdp: String)
  func signalingGotCandidate(_ json: String)
  func signalingInviteReceived(roomId: String, from: String, fromUserId: String?)
  func signalingClosed()
  func signalingError(_ message: String)
}

final class SignalingClient {
  weak var delegate: SignalingDelegate?
  private var task: URLSessionWebSocketTask?
  private var pingTimer: Timer?
  private var joinTimer: Timer?
  private var peerSeen = false
  private let roomId: String
  private let name: String
  private let inviteTo: String?
  private let inviteFrom: String?

  init(roomId: String, name: String, inviteTo: String? = nil, inviteFrom: String? = nil) {
    self.roomId = roomId; self.name = name
    self.inviteTo = inviteTo; self.inviteFrom = inviteFrom
  }

  func connect() {
    peerSeen = false
    let task = URLSession.shared.webSocketTask(with: Config.wsURL)
    self.task = task
    task.resume()
    sendJoin()
    listen()
    // ROOM_JOIN 유실 대비 4초 재전송 (서버 Set이라 멱등)
    joinTimer?.invalidate()
    joinTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in
      guard let self, !self.peerSeen else { return }
      self.sendJoin()
    }
    // 프록시 유휴 타임아웃 방지 25s heartbeat
    pingTimer?.invalidate()
    pingTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: true) { [weak self] _ in
      self?.send(.ping)
    }
  }

  func peerDidJoin() {
    peerSeen = true
    joinTimer?.invalidate()
  }

  func disconnect() {
    joinTimer?.invalidate(); pingTimer?.invalidate()
    task?.cancel(with: .goingAway, reason: nil)
    task = nil
  }

  func sendOffer(sdp: String) { send(.offer(roomId: roomId, sdp: sdp)) }
  func sendAnswer(sdp: String) { send(.answer(roomId: roomId, sdp: sdp)) }
  func sendCandidate(_ json: String) { send(.candidate(roomId: roomId, candidate: json)) }

  private func sendJoin() {
    send(.roomJoin(roomId: roomId, name: name, token: Store.shared.accessToken()))
    if let to = inviteTo {
      send(.callInvite(roomId: roomId, toUserId: to, from: name, fromUserId: inviteFrom))
    }
  }

  private func send(_ msg: SignalMessage) {
    guard let task else { return }
    do {
      let data = try msg.encode()
      task.send(.data(data)) { [weak self] err in
        if let err { self?.delegate?.signalingError("send: \(err.localizedDescription)") }
      }
    } catch {
      delegate?.signalingError("encode failed")
    }
  }

  private func listen() {
    task?.receive { [weak self] result in
      guard let self else { return }
      switch result {
      case let .success(.string(text)):
        self.handle(text: text)
      case let .success(.data(data)):
        if let text = String(data: data, encoding: .utf8) { self.handle(text: text) }
      case let .failure(err):
        self.delegate?.signalingError("ws: \(err.localizedDescription)")
        return
      default:
        break
      }
      self.listen()
    }
  }

  private func handle(text: String) {
    guard let data = text.data(using: .utf8),
          let msg = try? JSONDecoder().decode(SignalMessage.Incoming.self, from: data) else { return }
    switch msg.t {
    case "WELCOME", "ROOM_JOINED":
      delegate?.signalingDidOpen()
    case "ROOM_PEER_JOINED":
      delegate?.signalingPeerJoined(name: msg.name)
    case "SDP_OFFER":
      if let sdp = msg.sdp { delegate?.signalingGotOffer(sdp: sdp) }
    case "SDP_ANSWER":
      if let sdp = msg.sdp { delegate?.signalingGotAnswer(sdp: sdp) }
    case "ICE_CANDIDATE":
      if let c = msg.candidate { delegate?.signalingGotCandidate(c) }
    case "CALL_INVITE_DELIVERED", "CALL_INVITE":
      if let r = msg.roomId, let f = msg.from {
        delegate?.signalingInviteReceived(roomId: r, from: f, fromUserId: msg.fromUserId)
      }
    default:
      break
    }
  }
}
