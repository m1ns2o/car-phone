package com.carphone.app.net

import android.os.Handler
import android.os.Looper
import com.carphone.app.Config
import com.carphone.app.Store
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

// WebSocket 시그널링 (웹 useCall.ts와 동일 프로토콜)
class Signaling(
    private val roomId: String,
    private val name: String,
    private val inviteTo: String? = null,
    private val inviteFrom: String? = null,
    private val cb: Callback,
) {
    interface Callback {
        fun onOpen()
        fun onPeerJoined(name: String?)
        fun onPeerLeft()
        fun onCallEnd()
        fun onOffer(sdp: String)
        fun onAnswer(sdp: String)
        fun onCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?)
        fun onInvite(roomId: String, from: String, fromUserId: String?)
        fun onError(msg: String)
        fun onClosed()
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS) // 프록시 유휴 타임아웃 방지
        .build()
    private var ws: WebSocket? = null
    private val main = Handler(Looper.getMainLooper())
    // ROOM_JOIN 유실 대비 4초 재전송 (서버 Set이라 멱등)
    private val joinRetry = object : Runnable {
        override fun run() {
            if (peerSeen) return
            sendJoin()
            main.postDelayed(this, 4000)
        }
    }
    @Volatile private var peerSeen = false

    fun connect() {
        peerSeen = false
        val req = Request.Builder().url(Config.WS_URL).build()
        ws = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                sendJoin()
                main.postDelayed(joinRetry, 4000)
                cb.onOpen()
            }

            override fun onMessage(webSocket: WebSocket, text: String) = handle(text)

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                cb.onError("ws: ${t.message}")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                cb.onClosed()
            }
        })
    }

    fun markPeerSeen() {
        peerSeen = true
        main.removeCallbacks(joinRetry)
    }

    fun disconnect() {
        main.removeCallbacks(joinRetry)
        try { ws?.close(1000, "bye") } catch (_: Exception) { }
        ws = null
        client.dispatcher.executorService.shutdown()
    }

    fun sendOffer(sdp: String) = send(obj("SDP_OFFER").put("roomId", roomId).put("sdp", sdp))
    fun sendCallRequest(from: String) = send(obj("CALL_REQUEST").put("roomId", roomId).put("from", from))
    fun sendCallState(state: String) = send(obj("CALL_STATE").put("roomId", roomId).put("state", state))
    fun sendCallEnd() = send(obj("CALL_END").put("roomId", roomId))
    fun sendAnswer(sdp: String) = send(obj("SDP_ANSWER").put("roomId", roomId).put("sdp", sdp))
    fun sendCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?) {
        val o = obj("ICE_CANDIDATE").put("roomId", roomId).put("candidate", candidate)
        if (sdpMid != null) o.put("sdpMid", sdpMid) else o.put("sdpMid", JSONObject.NULL)
        if (sdpMLineIndex != null) o.put("sdpMLineIndex", sdpMLineIndex) else o.put("sdpMLineIndex", JSONObject.NULL)
        send(o)
    }

    private fun obj(t: String) = JSONObject().put("t", t)

    private fun sendJoin() {
        val j = obj("ROOM_JOIN").put("roomId", roomId).put("name", name)
        Store.accessToken()?.let { j.put("token", it) }
        send(j)
        inviteTo?.let {
            val inv = obj("CALL_INVITE").put("roomId", roomId).put("toUserId", it).put("from", name)
            inviteFrom?.let { f -> inv.put("fromUserId", f) }
            send(inv)
        }
    }

    private fun send(o: JSONObject) {
        try { ws?.send(o.toString()) } catch (_: Exception) { }
    }

    private fun handle(text: String) {
        val o = try { JSONObject(text) } catch (_: Exception) { return }
        when (o.optString("t")) {
            "ROOM_PEER_JOINED" -> cb.onPeerJoined(o.optString("name", null))
            "ROOM_PEER_LEFT" -> cb.onPeerLeft()
            "CALL_END" -> cb.onCallEnd()
            "SDP_OFFER" -> o.optString("sdp", null)?.let { cb.onOffer(it) }
            "SDP_ANSWER" -> o.optString("sdp", null)?.let { cb.onAnswer(it) }
            "ICE_CANDIDATE" -> {
                val c = o.optString("candidate", null)
                if (c != null) cb.onCandidate(c, o.optString("sdpMid", null), o.optInt("sdpMLineIndex", -1).takeIf { it >= 0 })
            }
            "CALL_INVITE", "CALL_INVITE_DELIVERED" -> {
                val r = o.optString("roomId", null); val f = o.optString("from", null)
                if (r != null && f != null) cb.onInvite(r, f, o.optString("fromUserId", null))
            }
        }
    }
}
