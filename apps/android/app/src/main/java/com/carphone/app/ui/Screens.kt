package com.carphone.app.ui

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carphone.app.Config
import com.carphone.app.Store
import com.carphone.app.call.CallService
import com.carphone.app.net.Api
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.launch
import kotlin.random.Random

// 홈: 스크롤 없이 입장 (웹 HomePage와 동일 구성)
@Composable
fun HomeScreen(onJoin: (String) -> Unit) {
    val ctx = LocalContext.current
    var room by remember { mutableStateOf(Random.nextInt(100000, 999999).toString(36)) }
    var copied by remember { mutableStateOf(false) }
    val name = Store.displayName.ifBlank { "guest" }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("CarPhone", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("내 표시 이름: $name", color = Night.Mist500)
        Card(
            Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Night.Card),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = room, onValueChange = { room = it },
                    label = { Text("방 ID") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { room = Random.nextInt(100000, 999999).toString(36) }) {
                        Text("새 방 ID", color = Night.Mint)
                    }
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = {
                        copy(ctx, Config.WEB_INVITE_BASE + room)
                        copied = true
                    }) { Text(if (copied) "복사됨!" else "초대링크", color = Night.Mint) }
                }
                Button(
                    onClick = {
                        CallService.join(ctx, room.trim().ifBlank { "room" }, name)
                        onJoin(room.trim().ifBlank { "room" })
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                ) { Text("통화방 입장", fontSize = 17.sp) }
            }
        }
        if (Store.accessToken() == null) {
            Text("로그인하면 친구 호출·통화기록 사용 가능", color = Night.Mist500)
        }
    }
}

private fun copy(ctx: Context, text: String) {
    (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
        .setPrimaryClip(ClipData.newPlainText("invite", text))
}

// 통화방 (웹 CallPage 구조: 아바타·타이머·pc/ice 칩·독·ICE·로그)
@Composable
fun CallScreen(room: String, svcOf: () -> CallService?, onLeave: () -> Unit, onHome: () -> Unit) {
    val ctx = LocalContext.current
    val svc = svcOf()
    val state by (svc?.state?.collectAsState()
        ?: remember { kotlinx.coroutines.flow.MutableStateFlow(CallService.State()) }.collectAsState())
    var copied by remember { mutableStateOf(false) }
    var showLog by remember { mutableStateOf(false) }

    // 통화 중 화면 꺼짐 방지 (웹 WakeLock 대응)
    val view = LocalView.current
    LaunchedEffect(state.status) {
        view.keepScreenOn = state.status == CallService.Status.CONNECTED ||
            state.status == CallService.Status.CONNECTING
    }

    val connected = state.status == CallService.Status.CONNECTED
    val closed = state.status == CallService.Status.CLOSED
    val title = state.peerDisplayName ?: state.peerName ?: room

    Column(
        Modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        StatusChip(state.status)
        // 아바타 — Discord식 링 + 연결 시 민트
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.padding(top = 8.dp).size(96.dp)
                .background(if (connected) Night.Mint else Night.Card2, CircleShape),
        ) {
            Text(
                state.name.ifBlank { "?" }.take(1).uppercase(),
                fontSize = 38.sp, fontWeight = FontWeight.ExtraBold,
                color = if (connected) Color(0xFF052E1B) else Color.White,
            )
        }
        Text(title, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold)
        Text(
            "나 ${state.name.ifBlank { "guest" }} · 상대 ${if (state.peerJoined) "입장함" else "대기 중"}",
            color = Night.Mist500, fontSize = 13.sp,
        )
        Text(
            "%02d:%02d".format(state.seconds / 60, state.seconds % 60),
            fontSize = 44.sp, fontWeight = FontWeight.ExtraBold,
        )
        // pc · ice 칩
        Box(
            modifier = Modifier.background(Night.Card, RoundedCornerShape(20.dp))
                .padding(horizontal = 12.dp, vertical = 6.dp),
        ) {
            Text(
                "pc ${state.pcState} · ice ${state.iceState}" +
                    (state.rttMs?.let { " · ${"%.0f".format(it)}ms" } ?: ""),
                color = Night.Mist500, fontSize = 11.sp, fontFamily = FontFamily.Monospace,
            )
        }
        // 초대링크 한 줄
        Card(colors = CardDefaults.cardColors(containerColor = Night.Card)) {
            Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(
                    (Config.WEB_INVITE_BASE + room).removePrefix("https://"),
                    modifier = Modifier.weight(1f),
                    maxLines = 1, color = Night.Mist300, fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                )
                TextButton(onClick = { copy(ctx, Config.WEB_INVITE_BASE + room); copied = true }) {
                    Text(if (copied) "복사됨" else "복사", color = Night.Mint)
                }
            }
        }
        state.error?.let {
            Text("⚠️ $it", color = Night.Rose, fontSize = 13.sp)
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = Night.Card),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    connected -> {
                        // 연결 시 원형 독 (음소거·종료)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                            DockButton(
                                label = if (state.muted) "음소거 해제" else "음소거",
                                bg = if (state.muted) Night.Amber else Night.Card2,
                                fg = if (state.muted) Color.Black else Color.White,
                                onClick = { svc?.toggleMute() },
                            ) { Text(if (state.muted) "🔇" else "🎙️", fontSize = 28.sp) }
                            DockButton(label = "종료", bg = Night.Rose, fg = Color.White, onClick = {
                                CallService.control(ctx, CallService.ACTION_LEAVE)
                                onLeave()
                            }) { Text("📞", fontSize = 28.sp) }
                        }
                    }
                    closed -> {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = onHome, modifier = Modifier.weight(1f)) { Text("홈으로") }
                            Button(
                                onClick = { CallService.join(ctx, room, state.name.ifBlank { "guest" }) },
                                modifier = Modifier.weight(1f),
                            ) { Text("다시 입장") }
                        }
                    }
                    else -> {
                        Button(
                            onClick = { svc?.beginCall() },
                            enabled = state.peerJoined,
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                        ) { Text(if (state.peerJoined) "통화 시작" else "상대 대기 중…", fontSize = 17.sp) }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { svc?.toggleMute() },
                        modifier = Modifier.weight(1f),
                    ) { Text(if (state.muted) "해제" else "음소거") }
                    OutlinedButton(
                        onClick = { svc?.restartIce() },
                        modifier = Modifier.weight(1f),
                    ) { Text("ICE 재시작") }
                }
                if (state.status == CallService.Status.CONNECTING || state.status == CallService.Status.FAILED) {
                    OutlinedButton(
                        onClick = { svc?.retryOffer() },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("다시 시도") }
                }
                if (!connected && !closed) {
                    TextButton(
                        onClick = {
                            CallService.control(ctx, CallService.ACTION_LEAVE)
                            onLeave()
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("나가기", color = Night.Rose) }
                }
            }
        }

        TextButton(onClick = { showLog = !showLog }, modifier = Modifier.fillMaxWidth()) {
            Text("연결 로그 (${state.logs.size})", color = Night.Mist300)
        }
        if (showLog) {
            LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
                items(state.logs.takeLast(40)) {
                    Text(it, color = Night.Mist500, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
            }
        }
        Text("운전 중에는 음소거 · 종료 두 버튼만 사용하세요", color = Night.Mist500, fontSize = 12.sp)
    }
}

@Composable
private fun StatusChip(status: CallService.Status) {
    val (label, color) = when (status) {
        CallService.Status.CONNECTED -> "연결됨" to Night.Mint
        CallService.Status.FAILED -> "실패" to Night.Rose
        CallService.Status.CLOSED -> "종료됨" to Night.Rose
        CallService.Status.CONNECTING -> "연결 중…" to Night.Amber
        CallService.Status.JOINING -> "입장 중…" to Night.Amber
        CallService.Status.WAITING -> "대기 중…" to Night.Amber
        CallService.Status.IDLE -> "대기" to Night.Mist500
    }
    Box(
        modifier = Modifier.background(color.copy(alpha = 0.15f), RoundedCornerShape(20.dp))
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) { Text(label, color = color, fontWeight = FontWeight.Bold) }
}

@Composable
private fun DockButton(label: String, bg: Color, fg: Color, onClick: () -> Unit, icon: @Composable () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        IconButton(
            onClick = onClick,
            modifier = Modifier.size(72.dp).background(bg, CircleShape),
        ) { Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) { icon() } }
        Text(label, color = Night.Mist500, fontSize = 12.sp)
    }
}

// 친구 (게스트는 로그인 안내)
@Composable
fun FriendsScreen(onCall: (String) -> Unit) {
    val ctx = LocalContext.current
    if (Store.accessToken() == null) {
        Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center) {
            Text("친구 호출은 로그인 후 사용 가능", color = Night.Mist500)
        }
        return
    }
    val scope = rememberCoroutineScope()
    var friends by remember { mutableStateOf<List<Api.Friend>>(emptyList()) }
    var requests by remember { mutableStateOf<List<Api.FriendRequest>>(emptyList()) }
    var username by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    fun load() = scope.launch {
        try {
            friends = Api.friends()
            requests = Api.incomingRequests()
            error = null
        } catch (e: Exception) { error = e.message }
    }
    LaunchedEffect(Unit) { load() }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = username, onValueChange = { username = it },
                    label = { Text("username") }, singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                Button(onClick = {
                    scope.launch {
                        try { Api.requestFriend(username); username = ""; load() }
                        catch (e: Exception) { error = e.message }
                    }
                }) { Text("요청") }
            }
        }
        if (requests.isNotEmpty()) {
            item { Text("받은 요청", fontWeight = FontWeight.Bold) }
            items(requests) { r ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(r.fromUsername)
                    Row {
                        TextButton(onClick = { scope.launch { Api.acceptRequest(r.id); load() } }) { Text("수락") }
                        TextButton(onClick = { scope.launch { Api.rejectRequest(r.id); load() } }) { Text("거절") }
                    }
                }
            }
        }
        item { Text("친구 (${friends.size})", fontWeight = FontWeight.Bold) }
        items(friends) { f ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${if (f.online) "● " else "○ "}${f.username}")
                Button(onClick = {
                    val room = "dm-${f.id.take(6)}"
                    CallService.join(
                        ctx, room, Store.displayName,
                        inviteTo = f.id, peerId = f.id, peerName = f.username,
                    )
                    onCall(room)
                }) { Text("통화") }
            }
        }
        error?.let { item { Text(it, color = Night.Rose) } }
    }
}

// 기록 (게스트는 로그인 안내)
@Composable
fun HistoryScreen() {
    if (Store.accessToken() == null) {
        Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center) {
            Text("통화기록은 로그인 후 사용 가능", color = Night.Mist500)
        }
        return
    }
    var records by remember { mutableStateOf<List<Api.CallRecord>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try { records = Api.history() } catch (e: Exception) { error = e.message }
    }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("통화기록", fontSize = 22.sp, fontWeight = FontWeight.Bold) }
        items(records) { r ->
            Column {
                Text((r.otherUsername ?: r.roomId), fontWeight = FontWeight.Bold)
                Text("${r.durationSec / 60}분 ${r.durationSec % 60}초 · ${r.status}", color = Night.Mist500)
            }
        }
        error?.let { item { Text(it, color = Night.Rose) } }
    }
}

// 설정
@Composable
fun SettingsScreen() {
    var name by remember { mutableStateOf(Store.displayName) }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("설정", fontSize = 22.sp, fontWeight = FontWeight.Bold)
        OutlinedTextField(
            value = name,
            onValueChange = { name = it; Store.displayName = it },
            label = { Text("표시 이름") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Text("API: carphone-api.m1ns2o.com", color = Night.Mist500)
        Text("버전: ${Config.APP_VERSION}", color = Night.Mist500)
        if (Store.accessToken() != null) {
            Button(onClick = { Store.clearTokens() }) { Text("로그아웃") }
        }
    }
}

// 진단 (웹 DebugPage 대응: 마이크·서버·오디오 장치)
@Composable
fun DiagScreen() {
    val ctx = LocalContext.current
    var health by remember { mutableStateOf("-") }
    var micState by remember { mutableStateOf("-") }
    var devices by remember { mutableStateOf(listOf<String>()) }
    var error by remember { mutableStateOf<String?>(null) }

    fun refresh() {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
        micState = if (androidx.core.content.ContextCompat.checkSelfPermission(
                ctx, android.Manifest.permission.RECORD_AUDIO,
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        ) "허용됨" else "미허용 (통화 입장 시 요청)"
        devices = am.getDevices(android.media.AudioManager.GET_DEVICES_ALL)
            .map { "${if (it.isSource) "IN" else "OUT"} ${it.productName} (type=${it.type})" }
    }
    LaunchedEffect(Unit) {
        refresh()
        health = try {
            val url = java.net.URL(Config.API_BASE + "/api/health")
            (url.openConnection() as java.net.HttpURLConnection).run {
                connectTimeout = 8000; readTimeout = 8000
                inputStream.bufferedReader().readText()
            }
        } catch (e: Exception) { "실패: ${e.message}" }
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("오디오 진단", fontSize = 22.sp, fontWeight = FontWeight.Bold) }
        item { Text("차량 BT 연결 전 마이크·서버 확인용.", color = Night.Mist500) }
        error?.let { item { Text("⚠️ $it", color = Night.Amber) } }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Night.Card)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("server $health", fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = Night.Mist300)
                    Text("마이크 권한: $micState", fontSize = 13.sp, color = Night.Mist300)
                    Text("MODE_NORMAL + USAGE_MEDIA (미디어 경로)", fontSize = 13.sp, color = Night.Mist300)
                    Button(onClick = {
                        try {
                            val rec = android.media.MediaRecorder(ctx)
                            rec.setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
                            rec.setOutputFormat(android.media.MediaRecorder.OutputFormat.THREE_GPP)
                            rec.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AMR_NB)
                            rec.setOutputFile("${ctx.cacheDir}/mic-test.3gp")
                            rec.prepare(); rec.start(); rec.stop(); rec.release()
                            error = null
                            micState = "녹음 테스트 성공"
                        } catch (e: Exception) {
                            error = "마이크 테스트 실패: ${e.message}"
                        }
                        refresh()
                    }) { Text("마이크 테스트") }
                }
            }
        }
        item { Text("오디오 장치 (${devices.size})", fontWeight = FontWeight.Bold) }
        items(devices) {
            Text(it, color = Night.Mist300, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
        }
    }
}

// 로그인 (Google 표준 플로우 + 게스트)
@Composable
fun LoginScreen(onGuest: () -> Unit, onLoggedIn: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(Store.displayName) }
    var error by remember { mutableStateOf<String?>(null) }

    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(Config.GOOGLE_SERVER_CLIENT_ID)
            .requestEmail()
            .build()
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        scope.launch {
            try {
                val task = GoogleSignIn.getSignedInAccountFromIntent(res.data)
                val acct = task.getResult(ApiException::class.java)
                val idToken = acct.idToken ?: throw IllegalStateException("idToken 없음 (SHA-1 미등록 가능)")
                val (access, refresh, user) = Api.loginGoogle(idToken)
                Store.saveTokens(access, refresh)
                Store.displayName = user.username
                onLoggedIn()
            } catch (e: Exception) {
                error = "Google 로그인 실패: ${e.message}"
            }
        }
    }

    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("CarPhone", fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("설치 없이 1:1 인터넷 음성통화", color = Night.Mist500)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = name,
            onValueChange = { name = it; Store.displayName = it },
            label = { Text("표시 이름 (게스트)") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                val client = GoogleSignIn.getClient(ctx, gso)
                launcher.launch(client.signInIntent)
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) { Text("G  Google 계정으로 로그인") }
        error?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = Night.Rose, fontSize = 13.sp)
        }
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onGuest, modifier = Modifier.fillMaxWidth()) {
            Text("게스트로 시작하기", color = Night.Mint)
        }
    }
}
