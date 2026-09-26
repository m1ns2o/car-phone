import Foundation
import Combine

// 로그인 유저용 전역 착신 감시 (웹 IncomingCallListener 대응)
struct IncomingInvite: Identifiable, Hashable {
  let id = UUID()
  let roomId: String
  let from: String
  let fromUserId: String?
}

final class IncomingInbox: ObservableObject {
  @Published var invite: IncomingInvite?
  private var task: URLSessionWebSocketTask?

  func watch(isLoggedIn: Bool) {
    stop()
    guard isLoggedIn else { return }
    let task = URLSession.shared.webSocketTask(with: Config.wsURL)
    self.task = task
    task.resume()
    listen()
  }

  func stop() {
    task?.cancel(with: .goingAway, reason: nil)
    task = nil
  }

  private func listen() {
    task?.receive { [weak self] result in
      guard let self else { return }
      if case let .success(.string(text)) = result,
         let data = text.data(using: .utf8),
         let msg = try? JSONDecoder().decode(SignalMessage.Incoming.self, from: data),
         msg.t == "CALL_INVITE",
         let r = msg.roomId, let f = msg.from
      {
        DispatchQueue.main.async {
          self.invite = IncomingInvite(roomId: r, from: f, fromUserId: msg.fromUserId)
        }
      }
      self.listen()
    }
  }
}
