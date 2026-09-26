import Foundation
import ObjectiveC
import UserNotifications

// APNs 일반 푸시 센터 (수신통화 카테고리: 수락/거절)
final class PushCenter: NSObject, UNUserNotificationCenterDelegate {
  static func setup() {
    let center = UNUserNotificationCenter.current()
    let delegate = PushCenter()
    objc_setAssociatedObject(center, "carphoneDelegate", delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
    center.delegate = delegate
    center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    center.setNotificationCategories([
      UNNotificationCategory(
        identifier: "INCOMING_CALL",
        actions: [
          UNNotificationAction(identifier: "ACCEPT", title: "수락", options: [.foreground]),
          UNNotificationAction(identifier: "REJECT", title: "거절", options: []),
        ],
        intentIdentifiers: [],
        options: []
      ),
    ])
  }

  // 수락 → 앱으로 진입해 통화방으로, 거절 → 무시
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    if response.actionIdentifier == "ACCEPT" {
      let info = response.notification.request.content.userInfo
      NotificationCenter.default.post(
        name: .acceptPushInvite,
        object: nil,
        userInfo: [
          "roomId": info["roomId"] as? String ?? "",
          "from": info["from"] as? String ?? "?",
          "fromUserId": info["fromUserId"] as? String ?? "",
        ]
      )
    }
    completionHandler()
  }
}

extension Notification.Name {
  static let acceptPushInvite = Notification.Name("acceptPushInvite")
}
