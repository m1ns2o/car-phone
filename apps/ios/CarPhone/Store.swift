import Foundation
import Security

// 토큰은 Keychain, 표시 이름은 UserDefaults
final class Store: ObservableObject {
  static let shared = Store()
  @Published var displayName: String {
    didSet { UserDefaults.standard.set(displayName, forKey: "displayName") }
  }

  init() {
    self.displayName = UserDefaults.standard.string(forKey: "displayName") ?? "guest"
  }

  func saveTokens(_ t: Tokens) {
    save(key: "accessToken", value: t.accessToken)
    save(key: "refreshToken", value: t.refreshToken)
  }

  func accessToken() -> String? { load(key: "accessToken") }
  func refreshToken() -> String? { load(key: "refreshToken") }
  func clearTokens() {
    delete(key: "accessToken"); delete(key: "refreshToken")
  }

  private func save(key: String, value: String) {
    let data = Data(value.utf8)
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                             kSecAttrAccount as String: "carphone.\(key)"]
    SecItemDelete(q as CFDictionary)
    var add = q; add[kSecValueData as String] = data
    SecItemAdd(add as CFDictionary, nil)
  }

  private func load(key: String) -> String? {
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                             kSecAttrAccount as String: "carphone.\(key)",
                             kSecReturnData as String: true]
    var out: AnyObject?
    guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess,
          let data = out as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  private func delete(key: String) {
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                             kSecAttrAccount as String: "carphone.\(key)"]
    SecItemDelete(q as CFDictionary)
  }
}

final class AuthState: ObservableObject {
  @Published var accessToken: String?
  @Published var guest = false
  @Published var me: User?
  init() { self.accessToken = Store.shared.accessToken() }
}
