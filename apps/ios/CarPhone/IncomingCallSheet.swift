import SwiftUI

// 수신 통화 모달 (웹 IncomingCallListener 대응)
struct IncomingCallSheet: View {
  let invite: IncomingInvite
  var onReject: () -> Void
  var onAccept: () -> Void

  var body: some View {
    VStack(spacing: 8) {
      Circle()
        .fill(Color.mint400.opacity(0.15))
        .frame(width: 64, height: 64)
        .overlay(Image(systemName: "phone.fill").font(.title2).foregroundColor(.mint400))
      Text("수신 통화").font(.title3).bold()
      Text("\(invite.from)님이 통화를 요청합니다")
        .foregroundColor(.mist500)
      HStack(spacing: 8) {
        Button {
          onReject()
        } label: {
          Label("거절", systemImage: "phone.down.fill")
            .frame(maxWidth: .infinity).padding()
            .background(Color.white.opacity(0.08)).cornerRadius(16)
        }
        Button {
          onAccept()
        } label: {
          Label("수락", systemImage: "phone.fill")
            .frame(maxWidth: .infinity).padding()
            .background(Color.mint400).foregroundColor(Color(red: 0x05 / 255, green: 0x2E / 255, blue: 0x1B / 255))
            .cornerRadius(16).bold()
        }
      }
      .padding(.top, 12)
    }
    .padding(24)
    .presentationDetents([.medium])
  }
}
