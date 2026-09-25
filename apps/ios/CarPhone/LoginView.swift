import SwiftUI

// Google Sign-In SDK 연동 자리 (SPM: GoogleSignIn-iOS 추가 후 교체)
struct LoginView: View {
  @EnvironmentObject var auth: AuthState
  @State private var error: String?
  @State private var guestName = Store.shared.displayName

  var body: some View {
    VStack(spacing: 16) {
      Spacer()
      Image(systemName: "phone.fill")
        .font(.system(size: 56)).foregroundColor(.green)
      Text("CarPhone").font(.largeTitle).bold()
      Text("설치 없이 1:1 인터넷 음성통화")
        .foregroundColor(.gray)

      TextField("표시 이름 (게스트)", text: $guestName)
        .textFieldStyle(.roundedBorder)
        .padding(.horizontal, 32)
        .onChange(of: guestName) { _, v in Store.shared.displayName = v }

      // TODO: GoogleSignIn SDK 버튼으로 교체 (GIDSignIn.sharedInstance.signIn)
      Button {
        // 게스트 모드: 토큰 없이 홈으로 (방 입장·게스트 통화 가능)
        auth.guest = true
      } label: {
        Label("게스트로 시작하기", systemImage: "person")
          .frame(maxWidth: .infinity).padding()
          .background(Color.green).foregroundColor(.black)
          .cornerRadius(16).bold()
      }
      .padding(.horizontal, 32)

      if let error {
        Text(error).foregroundColor(.red).font(.caption)
      }
      Spacer()
      Text("Google 로그인은 SDK 연동 후 활성화")
        .font(.caption).foregroundColor(.gray)
    }
  }
}
