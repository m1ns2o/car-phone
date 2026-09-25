import SwiftUI

// 홈: 스크롤 없이 입장 (웹 HomePage와 동일 구성)
struct HomeView: View {
  @State private var roomId = String(UUID().uuidString.prefix(6))
  @State private var showCall = false
  @State private var copied = false
  @EnvironmentObject var auth: AuthState
  private var name: String { auth.me?.username ?? Store.shared.displayName }

  var body: some View {
    NavigationStack {
      VStack(spacing: 12) {
        // 표시 이름
        NavigationLink { SettingsView() } label: {
          HStack {
            Circle()
              .fill(Color.green.opacity(0.2))
              .frame(width: 36, height: 36)
              .overlay(Text(String(name.prefix(1)).uppercased()).bold().foregroundColor(.green))
            VStack(alignment: .leading) {
              Text(name).bold()
              Text("내 표시 이름으로 입장합니다").font(.caption).foregroundColor(.gray)
            }
            Spacer()
            Image(systemName: "pencil")
          }
          .padding().background(Color(.secondarySystemBackground)).cornerRadius(16)
        }
        .buttonStyle(.plain)

        // 방 입장 카드
        VStack(spacing: 10) {
          TextField("room id", text: $roomId)
            .textFieldStyle(.roundedBorder)
            .autocapitalization(.none)
          HStack {
            Button("새 방 ID") { roomId = String(UUID().uuidString.prefix(6)) }
              .font(.subheadline)
            Spacer()
            Button {
              UIPasteboard.general.string = "https://carphone-web.pages.dev/call/\(roomId)"
              copied = true
              DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
            } label: {
              Label(copied ? "복사됨" : "초대링크", systemImage: copied ? "checkmark" : "link")
                .font(.caption).monospaced()
            }
          }
          Button {
            showCall = true
          } label: {
            Label("통화방 입장", systemImage: "phone.fill")
              .frame(maxWidth: .infinity).padding()
              .background(Color.green).foregroundColor(.black)
              .cornerRadius(16).bold()
          }
        }
        .padding().background(Color(.secondarySystemBackground)).cornerRadius(16)

        if auth.me == nil {
          Text("게스트 모드 — 로그인하면 친구 호출·통화기록 사용 가능")
            .font(.caption).foregroundColor(.gray)
        }
        Spacer()
      }
      .padding()
      .navigationTitle("CarPhone")
      .onAppear {
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "-autoroom"), args.count > i + 1 {
          roomId = args[i + 1]
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { showCall = true }
        }
      }
      .navigationDestination(isPresented: $showCall) {
        CallView(vm: CallViewModel(roomId: roomId, name: name))
      }
    }
  }
}
