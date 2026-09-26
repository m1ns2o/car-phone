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
  @EnvironmentObject var auth: AuthState
  @StateObject private var inbox = IncomingInbox()
  @State private var acceptTarget: AcceptTarget?

  var body: some View {
    NavigationStack {
    TabView {
      HomeView()
        .tabItem { Label("홈", systemImage: "house") }
      FriendsView()
        .tabItem { Label("친구", systemImage: "person.2") }
      HistoryView()
        .tabItem { Label("기록", systemImage: "clock") }
      DiagView()
        .tabItem { Label("진단", systemImage: "stethoscope") }
      SettingsView()
        .tabItem { Label("설정", systemImage: "gear") }
    }
    .tint(.mint400)
    .preferredColorScheme(.dark)
    .onAppear { inbox.watch(isLoggedIn: auth.accessToken != nil) }
    .onChange(of: auth.accessToken) { _, t in inbox.watch(isLoggedIn: t != nil) }
    .onReceive(NotificationCenter.default.publisher(for: .acceptPushInvite)) { note in
      let info = note.userInfo ?? [:]
      acceptTarget = AcceptTarget(
        room: info["roomId"] as? String ?? "",
        peerId: (info["fromUserId"] as? String).flatMap { $0.isEmpty ? nil : $0 },
        peerName: info["from"] as? String
      )
    }
    .sheet(item: $inbox.invite) { inv in
      IncomingCallSheet(invite: inv) {
        inbox.invite = nil
      } onAccept: {
        inbox.invite = nil
        acceptTarget = AcceptTarget(
          room: inv.roomId,
          peerId: inv.fromUserId,
          peerName: inv.from
        )
      }
    }
    .navigationDestination(item: $acceptTarget) { t in
      CallView(vm: CallViewModel(
        roomId: t.room,
        name: auth.me?.username ?? Store.shared.displayName,
        peerUserId: t.peerId,
        peerName: t.peerName,
        myUserId: auth.me?.id
      ))
    }
    }
  }
}

struct AcceptTarget: Identifiable, Hashable {
  let id = UUID()
  let room: String
  let peerId: String?
  let peerName: String?
}

final class AppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // 착신 푸시: 일반 APNs (탭해서 입장). PushKit+CallKit은 전화 경로가 되므로 사용 금지.
    PushCenter.setup()
    application.registerForRemoteNotifications()
    return true
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    Task { try? await API.shared.registerPushToken(hex) }
  }
}
