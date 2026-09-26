package com.carphone.app

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import com.carphone.app.call.CallService
import com.carphone.app.call.IncomingCallNotify
import com.carphone.app.car.CarBridge
import com.carphone.app.net.InviteWatcher
import com.carphone.app.ui.CallScreen
import com.carphone.app.ui.CarPhoneTheme
import com.carphone.app.ui.DiagScreen
import com.carphone.app.ui.FriendsScreen
import com.carphone.app.ui.HistoryScreen
import com.carphone.app.ui.HomeScreen
import com.carphone.app.ui.LoginScreen
import com.carphone.app.ui.Night
import com.carphone.app.ui.SettingsScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var svc: CallService? = null
    private var authed by mutableStateOf(false)
    private var watcher: InviteWatcher? = null
    private var resumed = false

    // 수신 통화 (인앱 다이얼로그용)
    private var incoming by mutableStateOf<CallService.Invite?>(null)
    // 알림 수락으로 들어온 방
    private var acceptedRoom by mutableStateOf<Triple<String, String?, String?>?>(null)

    private val conn = object : ServiceConnection {
        override fun onServiceConnected(n: ComponentName?, b: IBinder?) {
            val s = (b as CallService.LocalBinder).service()
            svc = s
            CarBridge.service = s
        }
        override fun onServiceDisconnected(n: ComponentName?) {
            svc = null
            CarBridge.service = null
        }
    }

    private val permReq = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        authed = Store.accessToken() != null || intent.getBooleanExtra("guest", false)
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) perms.add(Manifest.permission.POST_NOTIFICATIONS)
        if (perms.any { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }) {
            permReq.launch(perms.toTypedArray())
        }
        try {
            bindService(Intent(this, CallService::class.java), conn, Context.BIND_AUTO_CREATE)
        } catch (_: Exception) { }
        handleCallIntent(intent)
        setContent {
            CarPhoneTheme {
                Surface {
                    Root(
                        authed = authed,
                        onLogin = {
                            authed = true
                            startWatcher()
                            registerFcmToken()
                        },
                        svcOf = { svc },
                        incoming = incoming,
                        onAcceptInvite = { inv ->
                            incoming = null
                            IncomingCallNotify.dismiss(this)
                            acceptInvite(inv)
                        },
                        onRejectInvite = {
                            incoming = null
                            IncomingCallNotify.dismiss(this)
                        },
                        acceptedRoom = acceptedRoom,
                        onAcceptedConsumed = { acceptedRoom = null },
                    )
                }
            }
        }
        startWatcher()
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        IncomingCallNotify.dismiss(this)
    }

    override fun onPause() {
        super.onPause()
        resumed = false
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra("guest", false)) {
            authed = true
            return
        }
        handleCallIntent(intent)
        // 오버레이 수락 후 진입 (EXTRA_ROOM) → 통화 화면으로
        intent.getStringExtra(IncomingCallNotify.EXTRA_ROOM)?.let { room ->
            if (intent.action == null) {
                acceptedRoom = Triple(room, null, null)
            }
        }
    }

    // 로그인 후 FCM 토큰 등록 (FCM 미설정 시 무시)
    private fun registerFcmToken() {
        if (Store.accessToken() == null) return
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
                        try {
                            com.carphone.app.net.Api.registerPushToken(token)
                        } catch (_: Exception) { }
                    }
                }
        } catch (_: Exception) { }
    }

    private fun handleCallIntent(intent: Intent?) {
        when (intent?.action) {
            IncomingCallNotify.ACTION_ACCEPT -> {
                val room = intent.getStringExtra(IncomingCallNotify.EXTRA_ROOM) ?: return
                val from = intent.getStringExtra(IncomingCallNotify.EXTRA_FROM)
                val fromId = intent.getStringExtra(IncomingCallNotify.EXTRA_FROM_ID)
                IncomingCallNotify.dismiss(this)
                incoming = null
                acceptedRoom = Triple(room, fromId, from)
                acceptInvite(CallService.Invite(room, from ?: "?", fromId))
            }
            IncomingCallNotify.ACTION_REJECT -> {
                IncomingCallNotify.dismiss(this)
                incoming = null
            }
        }
    }

    private fun acceptInvite(inv: CallService.Invite) {
        val name = Store.displayName.ifBlank { "guest" }
        // 수신자는 CALL_INVITE 재전송 없이 입장 (발신 invite 불필요)
        CallService.join(this, inv.roomId, name, peerId = inv.fromUserId, peerName = inv.from)
        acceptedRoom = Triple(inv.roomId, inv.fromUserId, inv.from)
    }

    private fun startWatcher() {
        if (Store.accessToken() == null) return
        watcher?.stop()
        watcher = InviteWatcher(object : InviteWatcher.Callback {
            override fun onInvite(roomId: String, from: String, fromUserId: String?) {
                runOnUiThread {
                    val inv = CallService.Invite(roomId, from, fromUserId)
                    if (resumed) {
                        incoming = inv
                    } else {
                        IncomingCallNotify.show(this@MainActivity, roomId, from, fromUserId)
                    }
                }
            }
        }).also { it.start() }
    }

    override fun onDestroy() {
        watcher?.stop()
        try { unbindService(conn) } catch (_: Exception) { }
        super.onDestroy()
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

@Composable
private fun Root(
    authed: Boolean,
    onLogin: () -> Unit,
    svcOf: () -> CallService?,
    incoming: CallService.Invite?,
    onAcceptInvite: (CallService.Invite) -> Unit,
    onRejectInvite: () -> Unit,
    acceptedRoom: Triple<String, String?, String?>?,
    onAcceptedConsumed: () -> Unit,
) {
    if (!authed) {
        LoginScreen(onGuest = onLogin, onLoggedIn = onLogin)
        return
    }
    var tab by remember { mutableStateOf("home") }
    var callRoom by remember { mutableStateOf<String?>(null) }
    // 알림 수락 방이 오면 통화 화면으로
    if (acceptedRoom != null) {
        callRoom = acceptedRoom.first
        onAcceptedConsumed()
    }
    val tabs = listOf(
        Tab("home", "홈", Icons.Filled.Home),
        Tab("friends", "친구", Icons.Filled.People),
        Tab("history", "기록", Icons.Filled.History),
        Tab("diag", "진단", Icons.Filled.BugReport),
        Tab("settings", "설정", Icons.Filled.Settings),
    )
    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach {
                    NavigationBarItem(
                        selected = tab == it.route,
                        onClick = { tab = it.route; if (it.route != "call") callRoom = null },
                        icon = { Icon(it.icon, it.label) },
                        label = { Text(it.label) },
                    )
                }
            }
        },
    ) { pad ->
        androidx.compose.foundation.layout.Box(
            modifier = Modifier.padding(pad),
        ) {
            when {
                callRoom != null -> CallScreen(
                    room = callRoom!!, svcOf = svcOf,
                    onLeave = { callRoom = null },
                    onHome = { callRoom = null; tab = "home" },
                )
                tab == "home" -> HomeScreen(onJoin = { callRoom = it })
                tab == "friends" -> FriendsScreen(onCall = { callRoom = it })
                tab == "history" -> HistoryScreen()
                tab == "diag" -> DiagScreen()
                tab == "settings" -> SettingsScreen()
            }
        }
    }
    // 수신 통화 모달 (웹 IncomingCallListener 대응)
    incoming?.let { inv ->
        Dialog(onDismissRequest = onRejectInvite) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Night.Card),
                shape = RoundedCornerShape(24.dp),
            ) {
                Column(
                    Modifier.padding(24.dp).fillMaxWidth(),
                    horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("📞", fontSize = 40.sp)
                    Text("수신 통화", fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
                    Text("${inv.from}님이 통화를 요청합니다", color = Night.Mist500)
                    Row(
                        Modifier.fillMaxWidth().padding(top = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedButton(
                            onClick = onRejectInvite,
                            modifier = Modifier.weight(1f).height(52.dp),
                        ) { Text("거절") }
                        Button(
                            onClick = { onAcceptInvite(inv) },
                            modifier = Modifier.weight(1f).height(52.dp),
                        ) { Text("수락") }
                    }
                }
            }
        }
    }
}
