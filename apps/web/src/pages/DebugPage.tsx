import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, ArrowLeft } from 'lucide-react';
import { getHealth } from '@carphone/api';
import { Shell } from '../components/Shell';
import { Button, Card } from '../components/ui';

export function DebugPage() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [health, setHealth] = useState('-');
  const [settings, setSettings] = useState('-');
  const [wakeLock, setWakeLock] = useState('-');

  useEffect(() => {
    (async () => {
      try {
        setDevices(await navigator.mediaDevices.enumerateDevices());
      } catch (e) {
        setErr('enumerateDevices 실패: ' + String(e));
      }
      try {
        setHealth(JSON.stringify(await getHealth()));
      } catch (e) {
        setHealth('health 실패: ' + String(e));
      }
      setWakeLock('wakeLock' in navigator ? '지원됨' : '미지원');
    })();
  }, []);

  async function testMic() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = s.getAudioTracks()[0];
      setSettings(JSON.stringify(track?.getSettings() ?? {}, null, 2));
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch (e) {
      setErr('getUserMedia 실패 (HTTPS 필요): ' + String(e));
    }
  }

  const inputs = devices.filter((d) => d.kind === 'audioinput');
  const outputs = devices.filter((d) => d.kind === 'audiooutput');

  return (
    <Shell title="오디오 진단">
      <p className="mt-2 text-[14px] text-mist-500">Android Auto 테스트 전 마이크·스피커 노출 확인용.</p>
      {err && (
        <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-[13px] text-amber-300">
          ⚠️ {err}
        </div>
      )}

      <Card className="mt-3 p-5">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/8 px-2.5 py-1 font-mono text-[11px] text-mist-300">server {health}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-mist-300">WakeLock {wakeLock}</span>
        </div>
        <p className="mt-2 text-[13px] text-mist-500">audioinput {inputs.length}개 · audiooutput {outputs.length}개</p>
        <Button className="mt-3" onClick={() => void testMic()}>
          <Mic size={17} /> 마이크 테스트 (권한 요청)
        </Button>
      </Card>

      <Card className="mt-3 p-5">
        <p className="text-[13px] font-bold">🎤 audioinput</p>
        <ul className="mt-2 space-y-1.5">
          {inputs.map((d, i) => (
            <li key={i} className="rounded-xl bg-night-900 p-2.5">
              <p className="font-mono text-[12px] text-white">{d.label || `(라벨없음 ${i})`}</p>
              <p className="font-mono text-[11px] text-mist-500">{d.deviceId.slice(0, 12)}…</p>
            </li>
          ))}
          {inputs.length === 0 && <p className="text-[13px] text-mist-500">없음 (권한 허용 후 다시 확인)</p>}
        </ul>
      </Card>

      <Card className="mt-3 p-5">
        <p className="text-[13px] font-bold">🔊 audiooutput</p>
        <ul className="mt-2 space-y-1.5">
          {outputs.map((d, i) => (
            <li key={i} className="rounded-xl bg-night-900 p-2.5">
              <p className="font-mono text-[12px] text-white">{d.label || `(라벨없음 ${i})`}</p>
              <p className="font-mono text-[11px] text-mist-500">{d.deviceId.slice(0, 12)}…</p>
            </li>
          ))}
          {outputs.length === 0 && <p className="text-[13px] text-mist-500">없음</p>}
        </ul>
      </Card>

      <Card className="mt-3 p-5">
        <p className="text-[13px] font-bold">getSettings()</p>
        <pre className="mt-2 whitespace-pre-wrap break-all rounded-xl bg-night-900 p-3 font-mono text-[11px] text-mist-300">{settings}</pre>
      </Card>

      <Link to="/" className="mt-4 inline-flex items-center gap-1 text-[14px] font-bold text-mist-500">
        <ArrowLeft size={15} /> 홈으로
      </Link>
    </Shell>
  );
}
