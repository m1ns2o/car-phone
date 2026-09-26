package com.carphone.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.carphone.app.Config
import com.carphone.app.Store
import com.carphone.app.call.CallService
import com.carphone.app.net.Api
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
        Text("내 표시 이름: $name", color = Color.Gray)
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = room, onValueChange = { room = it },
                    label = { Text("방 ID") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { room = Random.nextInt(100000, 999999).toString(36) }) {
                        Text("새 방 ID")
                    }
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = {
                        copy(ctx, Config.WEB_INVITE_BASE + room)
                        copied = true
                    }) { Text(if (copied) "복사됨!" else "초대링크") }
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
        Text("로그인하면 친구 호출·통화기록 사용 가능", color = Color.Gray)
    }
}

private fun copy(ctx: Context, text: String) {
    (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
        .setPrimaryClip(ClipData.newPlainText("invite", text))
}

// 통화방
@Composable
fun CallScreen(room: String, svcOf: () -> CallService?, onLeave: () -> Unit) {
    val ctx = LocalContext.current
    val svc = svcOf()
    val state by (svc?.state?.collectAsState()
        ?: remember { kotlinx.coroutines.flow.MutableStateFlow(CallService.State()) }.collectAsState())
    var copied by remember { mutableStateOf(false) }

    LaunchedEffect(room) {
        if (svc?.state?.value?.status == CallService.Status.IDLE) {
            // 서비스가 아직 시작 전이면 시작 (HomeScreen에서 이미 join 호출됨)
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            when (state.status) {
                CallService.Status.IDLE -> "대기"
                CallService.Status.JOINING -> "입장 중…"
                CallService.Status.WAITING -> "대기 중"
                CallService.Status.CONNECTING -> "연결 중…"
                CallService.Status.CONNECTED -> "연결됨"
                CallService.Status.FAILED -> "실패"
            },
            fontWeight = FontWeight.Bold,
            color = if (state.status == CallService.Status.CONNECTED) Color(0xFF2E7D32) else Color.Gray,
        )
        Text(room, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(
            "${state.name.ifBlank { "나" }} · ${state.peerName ?: "상대 대기 중"}",
            color = Color.Gray,
        )
        Text(
            "%02d:%02d".format(state.seconds / 60, state.seconds % 60),
            fontSize = 44.sp, fontWeight = FontWeight.Bold,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                Config.WEB_INVITE_BASE + room,
                modifier = Modifier.weight(1f),
                maxLines = 1, color = Color.Gray,
            )
            TextButton(onClick = { copy(ctx, Config.WEB_INVITE_BASE + room); copied = true }) {
                Text(if (copied) "✓" else "복사")
            }
        }
        if (state.status == CallService.Status.CONNECTING || state.status == CallService.Status.FAILED) {
            OutlinedButton(
                onClick = { svc?.retryOffer() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text("다시 시도") }
        }
        if (state.status == CallService.Status.WAITING) {
            Button(
                onClick = { svc?.beginCall() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2E7D32)),
            ) { Text("통화 시작", fontSize = 17.sp) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = { svc?.toggleMute() },
                modifier = Modifier.weight(1f).height(52.dp),
            ) { Text(if (state.muted) "음소거 해제" else "음소거") }
            Button(
                onClick = {
                    CallService.control(ctx, CallService.ACTION_LEAVE)
                    onLeave()
                },
                modifier = Modifier.weight(1f).height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC62828)),
            ) { Text("나가기") }
        }
        Text("연결 로그 (${state.logs.size})", fontWeight = FontWeight.Bold)
        LazyColumn(Modifier.weight(1f)) {
            items(state.logs.takeLast(30)) { Text(it, color = Color.Gray) }
        }
    }
}

// 친구
@Composable
fun FriendsScreen(onCall: (String) -> Unit) {
    val ctx = LocalContext.current
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
                    CallService.join(ctx, room, Store.displayName, inviteTo = f.id, peerId = f.id)
                    onCall(room)
                }) { Text("통화") }
            }
        }
        error?.let { item { Text(it, color = Color.Red) } }
    }
}

// 기록
@Composable
fun HistoryScreen() {
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
                Text("${r.durationSec / 60}분 ${r.durationSec % 60}초 · ${r.status}", color = Color.Gray)
            }
        }
        error?.let { item { Text(it, color = Color.Red) } }
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
        Text("API: carphone-api.m1ns2o.com", color = Color.Gray)
        Text("버전: ${Config.APP_VERSION}", color = Color.Gray)
        if (Store.accessToken() != null) {
            Button(onClick = { Store.clearTokens() }) { Text("로그아웃") }
        }
    }
}

// 로그인 (Google SDK 연동 자리 + 게스트)
@Composable
fun LoginScreen(onGuest: () -> Unit) {
    var name by remember { mutableStateOf(Store.displayName) }
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
    ) {
        Text("CarPhone", fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("설치 없이 1:1 인터넷 음성통화", color = Color.Gray)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = name,
            onValueChange = { name = it; Store.displayName = it },
            label = { Text("표시 이름 (게스트)") }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        // TODO: Google Sign-In (play-services-auth) 버튼으로 교체
        Button(
            onClick = onGuest,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) { Text("게스트로 시작하기") }
        Spacer(Modifier.height(8.dp))
        Text("Google 로그인은 SDK 연동 후 활성화", color = Color.Gray)
    }
}
