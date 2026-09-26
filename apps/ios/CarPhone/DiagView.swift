import SwiftUI
import AVFoundation

// 진단 (웹 DebugPage 대응)
struct DiagView: View {
  @State private var health = "-"
  @State private var mic = "-"
  @State private var route = "-"
  @State private var error: String?

  var body: some View {
    NavigationStack {
      List {
        Section {
          Text("차량 BT 연결 전 마이크·서버 확인용.").foregroundColor(.mist500)
          LabeledContent("server", value: health).monospaced()
          LabeledContent("마이크 권한", value: mic)
          LabeledContent("오디오 경로", value: route)
          LabeledContent("세션", value: "playAndRecord/voiceChat (미디어 경로)")
        }
        Section {
          Button("마이크 테스트 (권한 요청)") {
            AVCaptureDevice.requestAccess(for: .audio) { granted in
              DispatchQueue.main.async {
                mic = granted ? "허용됨" : "거부됨"
                refresh()
              }
            }
          }
          .tint(.mint400)
          Button("새로고침") { refresh() }
        }
        if let error {
          Section { Text("⚠️ \(error)").foregroundColor(.callAmber).font(.caption) }
        }
      }
      .navigationTitle("진단")
      .task { refresh(); await loadHealth() }
    }
  }

  private func refresh() {
    let st = AVCaptureDevice.authorizationStatus(for: .audio)
    mic = switch st {
    case .authorized: "허용됨"
    case .denied, .restricted: "거부됨"
    case .notDetermined: "미요청 (통화 입장 시 요청)"
    @unknown default: "?"
    }
    let session = AVAudioSession.sharedInstance()
    route = (session.currentRoute.inputs.first?.portName ?? "-") + " → " +
      (session.currentRoute.outputs.first?.portName ?? "-")
  }

  private func loadHealth() async {
    do {
      let h = try await API.shared.health()
      health = h
    } catch {
      health = "실패: \(error.localizedDescription)"
    }
  }
}
