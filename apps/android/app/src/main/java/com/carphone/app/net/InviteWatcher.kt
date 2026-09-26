package com.carphone.app.net

import com.carphone.app.Config
import com.carphone.app.Store
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

// 로그인 유저용 전역 착신 감시 (웹 IncomingCallListener 대응).
// 방 입장 없이 WS만 연결하고 CALL_INVITE를 기다린다.
class InviteWatcher(private val cb: Callback) {
    interface Callback {
        fun onInvite(roomId: String, from: String, fromUserId: String?)
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .build()
    private var ws: WebSocket? = null

    fun start() {
        if (ws != null || Store.accessToken() == null) return
        ws = client.newWebSocket(Request.Builder().url(Config.WS_URL).build(), object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val o = try { JSONObject(text) } catch (_: Exception) { return }
                if (o.optString("t") == "CALL_INVITE") {
                    val r = o.optString("roomId", null); val f = o.optString("from", null)
                    if (r != null && f != null) cb.onInvite(r, f, o.optString("fromUserId", null))
                }
            }
        })
    }

    fun stop() {
        try { ws?.close(1000, "bye") } catch (_: Exception) { }
        ws = null
        client.dispatcher.executorService.shutdown()
    }
}
