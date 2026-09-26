package com.carphone.app

// 운영 주소. 로컬 개발 시 여기만 바꾸면 된다.
object Config {
    const val API_BASE = "https://carphone-api.m1ns2o.com"
    const val WS_URL = "wss://carphone-api.m1ns2o.com/ws"
    const val WEB_INVITE_BASE = "https://carphone-web.pages.dev/call/"
    const val STUN_URL = "stun:stun.l.google.com:19302"
    // Android용 Google OAuth 클라이언트 ID (서버_CLIENT_ID와 별도 발급 후 기입)
    const val GOOGLE_SERVER_CLIENT_ID = "611282380522-rbu3klsjoh8i8uisb0vnaa546ib8b6u0.apps.googleusercontent.com"
    const val APP_VERSION = "0.3.0-android"
}
