import Foundation

// REST 클라이언트 (서버 routes/* 와 1:1 대응)
final class API {
  static let shared = API()
  private let session = URLSession.shared

  struct ErrorBody: Error, LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }

  private func req(_ path: String, method: String = "GET", body: Encodable? = nil, auth: Bool = true) throws -> URLRequest {
    var r = URLRequest(url: Config.apiBase.appendingPathComponent(path))
    r.httpMethod = method
    r.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if auth, let t = Store.shared.accessToken() {
      r.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
    }
    if let body {
      r.httpBody = try JSONEncoder().encode(AnyEncodable(body))
    }
    return r
  }

  private func send<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
    let (data, resp) = try await session.data(for: request)
    guard let http = resp as? HTTPURLResponse else { throw ErrorBody(message: "no response") }
    guard (200..<300).contains(http.statusCode) else {
      let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "HTTP \(http.statusCode)"
      throw ErrorBody(message: msg)
    }
    if type == Empty.self { return Empty() as! T }
    return try JSONDecoder().decode(T.self, from: data)
  }

  struct Empty: Decodable {}

  // MARK: - auth
  struct GoogleBody: Encodable { let idToken: String }
  struct AuthResp: Decodable { let accessToken: String; let refreshToken: String; let user: User }

  func loginGoogle(idToken: String) async throws -> AuthResp {
    try await send(try req("/api/auth/google", method: "POST", body: GoogleBody(idToken: idToken), auth: false), as: AuthResp.self)
  }

  func me() async throws -> User {
    try await send(try req("/api/auth/me"), as: User.self)
  }

  func health() async throws -> String {
    let req = try self.req("/api/health", auth: false)
    let (data, _) = try await session.data(for: req)
    return String(data: data, encoding: .utf8) ?? "-"
  }

  // MARK: - friends
  struct UsernameBody: Encodable { let username: String }

  func friends() async throws -> [Friend] {
    try await send(try req("/api/friends"), as: [Friend].self)
  }

  func requestFriend(username: String) async throws {
    _ = try await send(try req("/api/friends/request", method: "POST", body: UsernameBody(username: username)), as: Empty.self)
  }

  func incomingRequests() async throws -> [FriendRequest] {
    try await send(try req("/api/friends/requests"), as: [FriendRequest].self)
  }

  func acceptRequest(id: String) async throws {
    _ = try await send(try req("/api/friends/requests/\(id)/accept", method: "POST"), as: Empty.self)
  }

  func rejectRequest(id: String) async throws {
    _ = try await send(try req("/api/friends/requests/\(id)/reject", method: "POST"), as: Empty.self)
  }

  func removeFriend(id: String) async throws {
    _ = try await send(try req("/api/friends/\(id)", method: "DELETE"), as: Empty.self)
  }

  // MARK: - calls
  struct RecordBody: Encodable {
    let roomId: String; let otherUserId: String?; let status: String; let durationSec: Int
  }

  func recordCall(roomId: String, otherUserId: String?, status: String, durationSec: Int) async throws {
    _ = try await send(
      try req("/api/calls", method: "POST",
              body: RecordBody(roomId: roomId, otherUserId: otherUserId, status: status, durationSec: durationSec)),
      as: Empty.self)
  }

  func history() async throws -> [CallRecord] {
    try await send(try req("/api/calls/history"), as: [CallRecord].self)
  }

  // MARK: - push
  struct PushTokenBody: Encodable { let platform: String; let token: String }

  func registerPushToken(_ hex: String) async throws {
    _ = try await send(
      try req("/api/push/token", method: "POST", body: PushTokenBody(platform: "ios", token: hex)),
      as: Empty.self)
  }
}

// type-erased Encodable
private struct AnyEncodable: Encodable {
  let base: Encodable
  init(_ base: Encodable) { self.base = base }
  func encode(to encoder: Encoder) throws { try base.encode(to: encoder) }
}
