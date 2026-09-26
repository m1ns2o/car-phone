import Foundation

// 서버와 주고받는 DTO (웹 packages/shared와 동일 스키마)
struct Tokens: Codable {
  let accessToken: String
  let refreshToken: String
}

struct User: Codable, Identifiable {
  let id: String
  let username: String
  let email: String?
  let online: Bool?
}

struct Friend: Codable, Identifiable {
  let id: String
  let username: String
  let online: Bool
}

struct FriendRequest: Codable, Identifiable {
  let id: String
  let fromUsername: String
}

struct CallRecord: Codable, Identifiable {
  let id: String
  let roomId: String
  let otherUsername: String?
  let status: String
  let durationSec: Int
  let startedAt: String
}

// 시그널링 메시지 (t 필드 디스패치)
enum SignalMessage: Codable {
  case roomJoin(roomId: String, name: String, token: String?)
  case offer(roomId: String, sdp: String)
  case answer(roomId: String, sdp: String)
  case candidate(roomId: String, candidate: String)
  case callInvite(roomId: String, toUserId: String, from: String, fromUserId: String?)
  case ping
  case unknown

  private enum T: String { case ROOM_JOIN, OFFER, ANSWER, CANDIDATE, CALL_INVITE, PING }

  func encode() throws -> Data {
    var d: [String: Any] = [:]
    switch self {
    case let .roomJoin(r, n, t): d = ["t": "ROOM_JOIN", "roomId": r, "name": n]; if let t { d["token"] = t }
    case let .offer(r, s): d = ["t": "SDP_OFFER", "roomId": r, "sdp": s]
    case let .answer(r, s): d = ["t": "SDP_ANSWER", "roomId": r, "sdp": s]
    case let .candidate(r, c): d = ["t": "ICE_CANDIDATE", "roomId": r, "candidate": c]
    case let .callInvite(r, to, f, fu): d = ["t": "CALL_INVITE", "roomId": r, "toUserId": to, "from": f]; if let fu { d["fromUserId"] = fu }
    case .ping: d = ["t": "PING"]
    case .unknown: d = ["t": "UNKNOWN"]
    }
    return try JSONSerialization.data(withJSONObject: d)
  }

  struct Incoming: Decodable {
    let t: String
    let roomId: String?
    let name: String?
    let sdp: String?
    let candidate: String?
    let sdpMid: String?
    let sdpMLineIndex: Int?
    let from: String?
    let fromUserId: String?
  }
}
