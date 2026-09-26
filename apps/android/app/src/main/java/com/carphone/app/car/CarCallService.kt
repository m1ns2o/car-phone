package com.carphone.app.car

import androidx.car.app.CarAppService
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.model.Action
import androidx.car.app.model.Pane
import androidx.car.app.model.PaneTemplate
import androidx.car.app.model.Row
import androidx.car.app.validation.HostValidator
import com.carphone.app.Store
import com.carphone.app.call.CallService

// Android Auto: 미디어 카테고리 화면.
// 통화=재생 패러다임: 입장/음소거/종료를 큰 액션으로 노출. 입력은 폰 마이크.
class CarCallService : CarAppService() {
    override fun createHostValidator(): HostValidator = HostValidator.ALLOW_ALL_HOSTS_VALIDATOR

    override fun onCreateSession(): Session = object : Session() {
        override fun onCreateScreen(intent: android.content.Intent): Screen =
            object : Screen(carContext) {
                override fun onGetTemplate(): androidx.car.app.model.Template {
                    val svc = CarBridge.service
                    val st = svc?.state?.value
                    val pane = Pane.Builder().setLoading(false)
                    if (st == null || st.status == CallService.Status.IDLE) {
                        pane.addRow(
                            Row.Builder().setTitle("CarPhone 대기 중")
                                .addText("폰에서 방에 입장하면 여기서 제어됩니다").build(),
                        )
                        pane.addAction(
                            Action.Builder().setTitle("새 방 입장")
                                .setOnClickListener {
                                    val room = (1000..9999).random().toString()
                                    CarCallServiceStarter.join(carContext, room)
                                    invalidate()
                                }.build(),
                        )
                    } else {
                        pane.addRow(
                            Row.Builder().setTitle("통화 중: ${st.roomId}")
                                .addText("${st.name} · ${st.peerName ?: "상대 대기 중"} · ${st.seconds / 60}:${"%02d".format(st.seconds % 60)}")
                                .build(),
                        )
                        pane.addAction(
                            Action.Builder().setTitle(if (st.muted) "음소거 해제" else "음소거")
                                .setOnClickListener { CarBridge.service?.toggleMute(); invalidate() }.build(),
                        )
                        pane.addAction(
                            Action.Builder().setTitle("종료")
                                .setOnClickListener { CarCallServiceStarter.leave(carContext); invalidate() }.build(),
                        )
                    }
                    return PaneTemplate.Builder(pane.build()).setTitle("CarPhone")
                        .setHeaderAction(Action.BACK).build()
                }
            }
    }
}

// 서비스 바인딩 브리지 (폰 프로세스 내 싱글톤)
object CarBridge {
    var service: CallService? = null
}

object CarCallServiceStarter {
    fun join(ctx: android.content.Context, room: String) {
        CallService.join(ctx, room, Store.displayName)
    }
    fun leave(ctx: android.content.Context) {
        CallService.control(ctx, CallService.ACTION_LEAVE)
    }
}
