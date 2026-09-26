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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.core.content.ContextCompat
import com.carphone.app.call.CallService
import com.carphone.app.car.CarBridge
import com.carphone.app.ui.CallScreen
import com.carphone.app.ui.FriendsScreen
import com.carphone.app.ui.HistoryScreen
import com.carphone.app.ui.HomeScreen
import com.carphone.app.ui.LoginScreen
import com.carphone.app.ui.SettingsScreen

class MainActivity : ComponentActivity() {
    private var svc: CallService? = null
    private var authed by mutableStateOf(false)

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
        // 테스트용: adb shell am start ... --ez guest true
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) perms.add(Manifest.permission.POST_NOTIFICATIONS)
        if (perms.any { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }) {
            permReq.launch(perms.toTypedArray())
        }
        // 서비스 바인딩 (통화 상태 구독용; 미실행이면 대기)
        try {
            bindService(Intent(this, CallService::class.java), conn, Context.BIND_AUTO_CREATE)
        } catch (_: Exception) { }
        setContent {
            MaterialTheme {
                Surface { Root(authed, { authed = true }, { svc }) }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.getBooleanExtra("guest", false)) authed = true
    }

    override fun onDestroy() {
        try { unbindService(conn) } catch (_: Exception) { }
        super.onDestroy()
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

@Composable
private fun Root(loggedIn: Boolean, onLogin: () -> Unit, svcOf: () -> CallService?) {
    if (!loggedIn) {
        LoginScreen(onGuest = onLogin)
        return
    }
    var tab by remember { mutableStateOf("home") }
    var callRoom by remember { mutableStateOf<String?>(null) }
    val tabs = listOf(
        Tab("home", "홈", Icons.Filled.Home),
        Tab("friends", "친구", Icons.Filled.People),
        Tab("history", "기록", Icons.Filled.History),
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
            modifier = androidx.compose.ui.Modifier.padding(pad),
        ) {
            when {
                callRoom != null -> CallScreen(room = callRoom!!, svcOf = svcOf, onLeave = { callRoom = null })
                tab == "home" -> HomeScreen(onJoin = { callRoom = it })
                tab == "friends" -> FriendsScreen(onCall = { callRoom = it })
                tab == "history" -> HistoryScreen()
                tab == "settings" -> SettingsScreen()
            }
        }
    }
}

// 알림 탭 등 외부 진입용
fun Context.openCall(room: String) {
    startActivity(Intent(this, MainActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    })
}
