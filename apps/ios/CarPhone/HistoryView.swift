import SwiftUI

struct HistoryView: View {
  @State private var records: [CallRecord] = []
  @State private var error: String?

  var body: some View {
    NavigationStack {
      List(records) { r in
        VStack(alignment: .leading, spacing: 4) {
          HStack {
            Text(r.otherUsername ?? r.roomId).bold()
            Spacer()
            Text(statusLabel(r.status)).font(.caption)
              .foregroundColor(r.status == "ended" ? .green : .gray)
          }
          Text("\(r.durationSec / 60)분 \(r.durationSec % 60)초 · \(r.startedAt.prefix(16))")
            .font(.caption).foregroundColor(.gray)
        }
      }
      .navigationTitle("통화기록")
      .refreshable { await load() }
      .task { await load() }
      .overlay {
        if let error { Text(error).foregroundColor(.red).font(.caption).padding() }
      }
    }
  }

  private func statusLabel(_ s: String) -> String {
    switch s {
    case "ended": return "종료"
    case "rejected": return "거절"
    case "missed": return "부재중"
    case "failed": return "실패"
    default: return s
    }
  }

  private func load() async {
    do { records = try await API.shared.history(); error = nil }
    catch { self.error = error.localizedDescription }
  }
}
