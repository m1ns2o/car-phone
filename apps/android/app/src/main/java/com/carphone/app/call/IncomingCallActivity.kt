package com.carphone.app.call

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carphone.app.MainActivity
import com.carphone.app.Store
import com.carphone.app.ui.CarPhoneTheme
import com.carphone.app.ui.Night

// 잠금화면에서도 뜨는 수신통화 오버레이 (수락/거절).
// FCM full-screen intent 또는 인앱 알림에서 진입. 45초 무응답 시 자동 종료.
class IncomingCallActivity : ComponentActivity() {
    private val timeout = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }
        val room = intent.getStringExtra(IncomingCallNotify.EXTRA_ROOM).orEmpty()
        val from = intent.getStringExtra(IncomingCallNotify.EXTRA_FROM) ?: "?"
        val fromId = intent.getStringExtra(IncomingCallNotify.EXTRA_FROM_ID)
        if (room.isBlank()) {
            finish()
            return
        }
        timeout.postDelayed({ finish() }, 45_000)
        setContent {
            CarPhoneTheme {
                Surface(Modifier.fillMaxSize(), color = Night.Bg) {
                    IncomingOverlay(room = room, from = from,
                        onAccept = {
                            timeout.removeCallbacksAndMessages(null)
                            IncomingCallNotify.dismiss(this)
                            val name = Store.displayName.ifBlank { "guest" }
                            CallService.join(this, room, name, peerId = fromId, peerName = from)
                            startActivity(
                                Intent(this, MainActivity::class.java)
                                    .putExtra(IncomingCallNotify.EXTRA_ROOM, room)
                                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                            )
                            finish()
                        },
                        onReject = {
                            timeout.removeCallbacksAndMessages(null)
                            IncomingCallNotify.dismiss(this)
                            finish()
                        })
                }
            }
        }
    }

    override fun onDestroy() {
        timeout.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}

@Composable
private fun IncomingOverlay(room: String, from: String, onAccept: () -> Unit, onReject: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("📞", fontSize = 56.sp)
        Spacer(Modifier.height(12.dp))
        Text("수신 통화", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Color.White)
        Text("$from 님이 통화를 요청합니다", color = Night.Mist500)
        Text("방 $room", color = Night.Mist500, fontSize = 12.sp)
        Spacer(Modifier.height(32.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(
                onClick = onReject,
                modifier = Modifier.weight(1f).height(56.dp),
            ) { Text("거절", fontSize = 17.sp) }
            Button(
                onClick = onAccept,
                modifier = Modifier.weight(1f).height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Night.Mint,
                    contentColor = Color(0xFF052E1B),
                ),
            ) { Text("수락", fontSize = 17.sp, fontWeight = FontWeight.Bold) }
        }
    }
}
