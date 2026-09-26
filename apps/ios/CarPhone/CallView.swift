import SwiftUI

// 통화방 (웹 CallPage 구조)
struct CallView: View {
  @StateObject var vm: CallViewModel
  @Environment(\.dismiss) var dismiss
  @State private var copied = false
  @State private var showLog = false

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        statusChip
        // 아바타
        Circle()
          .fill(vm.status == .connected ? Color.mint400 : Color.night700)
          .frame(width: 96, height: 96)
          .overlay(
            Text(String((vm.name).prefix(1)).uppercased())
              .font(.system(size: 38, weight: .heavy))
              .foregroundColor(vm.status == .connected ? Color(red: 0x05 / 255, green: 0x2E / 255, blue: 0x1B / 255) : .white)
          )
          .padding(.top, 8)
        Text(vm.title).font(.title3).bold()
        Text("나 \(vm.name) · 상대 \(vm.peerJoined ? "입장함" : "대기 중")")
          .font(.subheadline).foregroundColor(.mist500)
        Text(fmt(vm.seconds))
          .font(.system(size: 44, weight: .heavy, design: .monospaced))
        // pc · ice 칩
        Text("pc \(vm.connectionState) · ice \(vm.iceState)" + (vm.rttMs.map { String(format: " · %.0fms", $0) } ?? ""))
          .font(.caption).monospaced()
          .padding(.horizontal, 12).padding(.vertical, 6)
          .background(Color.white.opacity(0.05)).cornerRadius(20)
          .foregroundColor(.mist500)

        // 초대링크 한 줄
        HStack {
          Image(systemName: "link").foregroundColor(.mint400)
          Text(vm.inviteURL.replacingOccurrences(of: "https://", with: ""))
            .font(.caption).monospaced().lineLimit(1).truncationMode(.middle)
            .foregroundColor(.mist300)
          Spacer()
          Button {
            UIPasteboard.general.string = vm.inviteURL
            copied = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
          } label: {
            Image(systemName: copied ? "checkmark" : "doc.on.doc")
          }
        }
        .padding().background(Color.night800).cornerRadius(14)

        if let err = vm.error {
          Text("⚠️ \(err)").font(.caption).foregroundColor(.callRose)
            .padding().background(Color.callRose.opacity(0.1)).cornerRadius(14)
        }

        VStack(spacing: 8) {
          switch vm.status {
          case .connected:
            // 원형 독
            HStack(spacing: 32) {
              dockButton(
                label: vm.muted ? "음소거 해제" : "음소거",
                system: vm.muted ? "mic.slash.fill" : "mic.fill",
                bg: vm.muted ? .callAmber : Color.white.opacity(0.1),
                fg: vm.muted ? .black : .white
              ) { vm.toggleMute() }
              dockButton(label: "종료", system: "phone.down.fill", bg: .callRose, fg: .white) {
                vm.leave(); dismiss()
              }
            }
            .padding(.vertical, 8)
          case .closed:
            HStack {
              Button("홈으로") { dismiss() }
                .frame(maxWidth: .infinity).padding()
                .background(Color.white.opacity(0.08)).cornerRadius(16)
              Button("다시 입장") { vm.start() }
                .frame(maxWidth: .infinity).padding()
                .background(Color.mint400)
                .foregroundColor(Color(red: 0x05 / 255, green: 0x2E / 255, blue: 0x1B / 255))
                .cornerRadius(16).bold()
            }
          default:
            Button {
              vm.beginCall()
            } label: {
              Label(vm.peerJoined ? "통화 시작" : "상대 대기 중…", systemImage: "phone.fill")
                .frame(maxWidth: .infinity).padding()
                .background(vm.peerJoined ? Color.mint400 : Color.gray.opacity(0.3))
                .foregroundColor(vm.peerJoined ? Color(red: 0x05 / 255, green: 0x2E / 255, blue: 0x1B / 255) : .white)
                .cornerRadius(16).bold()
            }
            .disabled(!vm.peerJoined)
          }

          HStack {
            Button(vm.muted ? "해제" : "음소거") { vm.toggleMute() }
              .frame(maxWidth: .infinity).padding(.vertical, 10)
              .background(Color.white.opacity(0.05)).cornerRadius(12)
            Button("ICE 재시작") { vm.restartIce() }
              .frame(maxWidth: .infinity).padding(.vertical, 10)
              .background(Color.white.opacity(0.05)).cornerRadius(12)
          }
          .font(.subheadline).bold()

          if vm.status == .connecting || vm.status == .failed {
            Button("다시 시도") { vm.retryOffer() }
              .frame(maxWidth: .infinity).padding(.vertical, 10)
              .background(Color.white.opacity(0.05)).cornerRadius(12)
              .font(.subheadline).bold()
          }
          if vm.status != .connected && vm.status != .closed {
            Button("나가기") { vm.leave(); dismiss() }
              .frame(maxWidth: .infinity).foregroundColor(.callRose)
              .font(.subheadline).bold()
          }
        }
        .padding().background(Color.night800).cornerRadius(16)

        Button("연결 로그 (\(vm.logs.count))") { showLog.toggle() }
          .font(.subheadline).bold().foregroundColor(.mist300)
        if showLog {
          VStack(alignment: .leading) {
            ForEach(vm.logs.suffix(40), id: \.self) { l in
              Text(l).font(.caption).monospaced().foregroundColor(.mist500)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding().background(Color.night800).cornerRadius(14)
        }
        Text("운전 중에는 음소거 · 종료 두 버튼만 사용하세요")
          .font(.caption).foregroundColor(.mist500).padding(.bottom, 8)
      }
      .padding()
    }
    .background(Color.night950)
    .navigationTitle("방 \(vm.roomId)")
    .navigationBarTitleDisplayMode(.inline)
    .onAppear {
      UIApplication.shared.isIdleTimerDisabled = true // 화면 꺼짐 방지 (웹 WakeLock 대응)
      vm.start()
    }
    .onDisappear {
      UIApplication.shared.isIdleTimerDisabled = false
      vm.leave()
    }
  }

  @ViewBuilder
  private var statusChip: some View {
    let (label, color): (String, Color) = switch vm.status {
    case .idle: ("대기", .mist500)
    case .joining: ("입장 중…", .callAmber)
    case .waitingPeer: ("대기 중…", .callAmber)
    case .connecting: ("연결 중…", .callAmber)
    case .connected: ("연결됨", .mint400)
    case .failed: ("실패", .callRose)
    case .closed: ("종료됨", .callRose)
    }
    Text(label).bold().padding(.horizontal, 14).padding(.vertical, 6)
      .background(color.opacity(0.15)).foregroundColor(color).cornerRadius(20)
  }

  private func fmt(_ s: Int) -> String {
    String(format: "%02d:%02d", s / 60, s % 60)
  }

  @ViewBuilder
  private func dockButton(label: String, system: String, bg: Color, fg: Color, action: @escaping () -> Void) -> some View {
    VStack(spacing: 4) {
      Button(action: action) {
        Image(systemName: system).font(.title2)
          .frame(width: 72, height: 72)
          .background(bg).foregroundColor(fg).cornerRadius(36)
      }
      Text(label).font(.caption).foregroundColor(.mist500)
    }
  }
}
