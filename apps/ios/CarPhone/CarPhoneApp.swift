import SwiftUI

// CarPhone — 1:1 WebRTC 음성통화 (미디어 경로, CallKit 미사용)
// 차량 스피커 출력 + 내비 ducking 허용이 목표. 통화 오디오 경로는 쓰지 않는다.

@main
struct CarPhoneApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
  @StateObject private var auth: AuthState

  init() {
    let a = AuthState()
    // UI 테스트용: -autoguest -autoroom <id>
    if CommandLine.arguments.contains("-autoguest") { a.guest = true }
    _auth = StateObject(wrappedValue: a)
  }

  var body: some Scene {
    WindowGroup {
      if auth.accessToken == nil && !auth.guest {
        LoginView().environmentObject(auth)
      } else {
        MainTabs().environmentObject(auth)
      }
    }
  }
}

struct MainTabs: View {
  var body: some View {
    TabView {
      HomeView()
        .tabItem { Label("홈", systemImage: "house") }
      FriendsView()
        .tabItem { Label("친구", systemImage: "person.2") }
      HistoryView()
        .tabItem { Label("기록", systemImage: "clock") }
      SettingsView()
        .tabItem { Label("설정", systemImage: "gear") }
    }
    .tint(Color(red: 0.2, green: 0.9, blue: 0.55))
  }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // 착신 푸시: 일반 APNs (탭해서 입장). PushKit+CallKit은 전화 경로가 되므로 사용 금지.
    application.registerForRemoteNotifications()
    return true
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    Task { try? await API.shared.registerPushToken(hex) }
  }
}
