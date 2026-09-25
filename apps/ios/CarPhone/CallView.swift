import SwiftUI

// 통화방: 큰 버튼 + 초대링크 공유 (운전 중 조작 기준)
struct CallView: View {
  @StateObject var vm: CallViewModel
  @Environment(\.dismiss) var dismiss
  @State private var copied = false

  var body: some View {
    VStack(spacing: 14) {
      statusChip
      Text(vm.roomId).font(.title2).bold()
      Text("나 \(vm.name)" + (vm.peerName.map { " · \($0)" } ?? " · 상대 대기 중"))
        .foregroundColor(.gray)
      timerText

      // 초대링크 공유 (한 줄)
      HStack {
        Image(systemName: "link").foregroundColor(.green)
        Text(vm.inviteURL.replacingOccurrences(of: "https://", with: ""))
          .font(.caption).monospaced().lineLimit(1).truncationMode(.middle)
        Spacer()
        Button {
          UIPasteboard.general.string = vm.inviteURL
          copied = true
          DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
        } label: {
          Image(systemName: copied ? "checkmark" : "doc.on.doc")
        }
      }
      .padding().background(Color(.secondarySystemBackground)).cornerRadius(14)

      if vm.status == .waitingPeer {
        Button("통화 시작") { vm.beginCall() }
          .frame(maxWidth: .infinity).padding()
          .background(Color.green).foregroundColor(.black).cornerRadius(16).bold()
      }
      HStack(spacing: 12) {
        Button {
          vm.toggleMute()
        } label: {
          Label(vm.muted ? "음소거 해제" : "음소거", systemImage: vm.muted ? "mic.slash.fill" : "mic.fill")
            .frame(maxWidth: .infinity).padding()
            .background(Color(.secondarySystemBackground)).cornerRadius(16)
        }
        Button {
          vm.leave(); dismiss()
        } label: {
          Label("나가기", systemImage: "phone.down.fill")
            .frame(maxWidth: .infinity).padding()
            .background(Color.red.opacity(0.9)).foregroundColor(.white).cornerRadius(16)
        }
      }

      // 연결 로그
      DisclosureGroup("연결 로그 (\(vm.logs.count))") {
        ScrollView {
          VStack(alignment: .leading) {
            ForEach(vm.logs.indices, id: \.self) { i in
              Text(vm.logs[i]).font(.caption).monospaced().foregroundColor(.gray)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxHeight: 160)
      }
      Spacer()
      Text("운전 중에는 음소거 · 나가기 두 버튼만 사용하세요")
        .font(.caption).foregroundColor(.gray)
    }
    .padding()
    .navigationTitle("방 \(vm.roomId)")
    .navigationBarTitleDisplayMode(.inline)
    .onAppear { vm.start() }
    .onDisappear { vm.leave() }
  }

  @ViewBuilder
  private var statusChip: some View {
    let (label, color): (String, Color) = switch vm.status {
    case .idle: ("대기", .gray)
    case .joining: ("입장 중…", .yellow)
    case .waitingPeer: ("대기 중", .yellow)
    case .connecting: ("연결 중…", .yellow)
    case .connected: ("연결됨", .green)
    case .failed: ("실패", .red)
    }
    Text(label).bold().padding(.horizontal, 14).padding(.vertical, 6)
      .background(color.opacity(0.15)).foregroundColor(color).cornerRadius(20)
  }

  private var timerText: some View {
    Text(String(format: "%02d:%02d", vm.seconds / 60, vm.seconds % 60))
      .font(.system(size: 44, weight: .bold, design: .monospaced))
  }
}
