import Foundation

// 운영 주소. 로컬 개발 시 여기만 바꾸면 된다.
enum Config {
  static let apiBase = URL(string: "https://carphone-api.m1ns2o.com")!
  static var wsURL: URL { URL(string: "wss://carphone-api.m1ns2o.com/ws")! }
  // iOS용 Google OAuth 클라이언트 ID (Google Cloud 콘솔에서 iOS 유형으로 발급 후 기입)
  static let googleClientID = "611282380522-rbu3klsjoh8i8uisb0vnaa546ib8b6u0.apps.googleusercontent.com"
  static let appVersion = "0.3.0-ios"
}
