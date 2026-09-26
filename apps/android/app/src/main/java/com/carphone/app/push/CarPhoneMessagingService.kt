package com.carphone.app.push

import com.carphone.app.call.IncomingCallNotify
import com.carphone.app.net.Api
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

// 착신 FCM 수신 → 잠금화면 오버레이 알림
class CarPhoneMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(msg: RemoteMessage) {
        val d = msg.data
        if (d["kind"] != "call-invite") return
        val room = d["roomId"] ?: return
        val from = d["from"] ?: "?"
        val fromId = d["fromUserId"]?.takeIf { it.isNotBlank() }
        IncomingCallNotify.showFullScreen(this, room, from, fromId)
    }

    override fun onNewToken(token: String) {
        scope.launch {
            try {
                Api.registerPushToken(token)
            } catch (_: Exception) { }
        }
    }
}
