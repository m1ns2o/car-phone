import AVFoundation

// 미디어 경로 오디오 세션: CallKit/전화 경로를 쓰지 않는다.
// - CarPlay: 차량 마이크+스피커 자동 라우트, 내비 ducking 허용
// - 일반 BT: A2DP 미디어 출력, 입력은 폰 마이크
enum CallAudio {
  static func configure() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(
      .playAndRecord,
      mode: .voiceChat, // AEC 유지
      options: [.defaultToSpeaker, .allowBluetoothA2DP, .allowAirPlay]
    )
    try session.setActive(true)
  }

  static func teardown() throws {
    try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
