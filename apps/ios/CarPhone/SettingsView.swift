import SwiftUI

struct SettingsView: View {
  @EnvironmentObject var auth: AuthState
  @State private var name = Store.shared.displayName

  var body: some View {
    NavigationStack {
      Form {
        Section("표시 이름") {
          TextField("guest", text: $name)
            .onChange(of: name) { _, v in Store.shared.displayName = v }
        }
        Section("서버") {
          LabeledContent("API", value: "carphone-api.m1ns2o.com")
          LabeledContent("버전", value: Config.appVersion)
        }
        if let me = auth.me {
          Section("계정") {
            LabeledContent("ID", value: me.username)
            Button("로그아웃", role: .destructive) {
              Store.shared.clearTokens()
              auth.accessToken = nil; auth.me = nil
            }
          }
        }
      }
      .navigationTitle("설정")
    }
  }
}
