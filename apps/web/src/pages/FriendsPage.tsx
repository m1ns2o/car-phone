import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Search, UserPlus, Check, X, Trash2, LogOut, ChevronRight } from 'lucide-react';
import { friendsApi, usersApi } from '@carphone/api';
import type { Friend, FriendRequest } from '@carphone/shared';
import { Shell } from '../components/Shell';
import { Button, Card, Field } from '../components/ui';
import { useAuth } from '../stores/auth';
import { cn } from '../lib/cn';

type Incoming = FriendRequest & { senderName?: string };
type Outgoing = FriendRequest & { receiverName?: string };

// 카카오톡/라인식 단일 친구 화면:
// - 상단: 타이틀 + 추가 버튼(바텀시트) / 내 친구 검색창
// - 받은 요청이 있으면 상단 섹션으로 인라인 표시
// - 친구 행: 아바타·온라인점·전화 버튼
export function FriendsPage() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [outgoing, setOutgoing] = useState<Outgoing[]>([]);
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [searched, setSearched] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, r] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
    setFriends(f.data.friends);
    setIncoming(r.data.incoming);
    setOutgoing(r.data.outgoing);
  }, []);

  useEffect(() => {
    void load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 15000); // presence 갱신
    return () => clearInterval(t);
  }, [load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.username.toLowerCase().includes(q));
  }, [friends, filter]);

  async function doSearch() {
    if (!query.trim()) return;
    try {
      const r = await usersApi.search(query.trim());
      setResults(r.data.users);
      setSearched(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '검색 실패');
    }
  }

  function newRoom(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  }

  function callFriend(f: Friend) {
    const room = newRoom();
    nav(
      `/call/${room}?name=${encodeURIComponent(user?.username ?? '')}&peerId=${encodeURIComponent(f.id)}&peerName=${encodeURIComponent(f.username)}`,
    );
  }

  return (
    <Shell title="친구">
      {/* 헤더: 타이틀 + 추가 버튼 (카톡식) */}
      <div className="mt-3 flex items-center gap-2">
        <h2 className="flex-1 text-[19px] font-extrabold">
          내 친구 <span className="text-mint-400">{friends.length}</span>
        </h2>
        {incoming.length > 0 && (
          <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[12px] font-bold text-rose-500">
            요청 {incoming.length}
          </span>
        )}
        <button
          onClick={() => {
            setShowAdd(true);
            setMsg(null);
          }}
          aria-label="친구 추가"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-400 text-[#052e1b] transition active:scale-95"
        >
          <UserPlus size={19} />
        </button>
      </div>

      {/* 내 친구 검색 (목록 필터) */}
      <div className="relative mt-3">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist-500" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="친구 검색"
          className="w-full rounded-2xl border border-white/10 bg-night-800 py-3 pl-11 pr-4 text-[15px] text-white outline-none placeholder:text-mist-500/60 focus:border-mint-400/60"
        />
      </div>

      {/* 받은 요청 — 인라인 섹션 */}
      {incoming.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[13px] font-bold text-mist-300">받은 요청</p>
          <div className="space-y-2">
            {incoming.map((r) => (
              <Card key={r.id} className="flex items-center gap-3 p-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-night-700 text-[16px] font-extrabold">
                  {(r.senderName ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 text-[15px] font-bold">{r.senderName ?? '알 수 없음'}</span>
                <button
                  onClick={() => void friendsApi.accept(r.id).then(() => load())}
                  aria-label="수락"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-400 text-[#052e1b]"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => void friendsApi.reject(r.id).then(() => load())}
                  aria-label="거절"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-white"
                >
                  <X size={18} />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 친구 목록 */}
      <div className="mt-3 space-y-2">
        {visible.map((f) => (
          <Card key={f.id} className="flex items-center gap-3 p-3.5">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-night-700 text-[18px] font-extrabold">
              {f.username.slice(0, 1).toUpperCase()}
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-night-800',
                  f.online ? 'bg-mint-400' : 'bg-mist-500',
                )}
              />
            </span>
            <button onClick={() => callFriend(f)} className="flex-1 text-left">
              <span className="block text-[15px] font-bold">{f.username}</span>
              <span className="block text-[12px] text-mist-500">{f.online ? '온라인 · 탭하여 통화' : '오프라인'}</span>
            </button>
            <button
              onClick={() => callFriend(f)}
              aria-label={`call ${f.username}`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-mint-400 text-[#052e1b] transition active:scale-95"
            >
              <Phone size={19} />
            </button>
            <button
              onClick={() => void friendsApi.remove(f.id).then(() => load())}
              aria-label="삭제"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-mist-500"
            >
              <Trash2 size={17} />
            </button>
          </Card>
        ))}
        {visible.length === 0 && (
          <Card className="p-6 text-center text-[13px] leading-relaxed text-mist-500">
            {friends.length === 0 ? (
              <>
                아직 친구가 없습니다.
                <br />
                오른쪽 위 <UserPlus size={13} className="inline" /> 버튼으로 아이디를 검색해 추가하세요.
              </>
            ) : (
              '검색 결과가 없습니다.'
            )}
          </Card>
        )}
      </div>

      {/* 보낸 요청 (대기 중) — 접이식 한 줄 */}
      {outgoing.length > 0 && (
        <details className="mt-3 rounded-2xl border border-white/8 bg-night-800/90">
          <summary className="flex cursor-pointer list-none items-center gap-1 p-3.5 text-[13px] font-bold text-mist-500">
            보낸 요청 {outgoing.length}개 대기 중 <ChevronRight size={15} />
          </summary>
          <div className="space-y-1.5 border-t border-white/8 p-3.5 pt-3">
            {outgoing.map((r) => (
              <p key={r.id} className="text-[13px] text-mist-500">
                → {r.receiverName ?? r.id}
              </p>
            ))}
          </div>
        </details>
      )}

      <button
        onClick={() => void logout().then(() => nav('/'))}
        className="mx-auto mt-4 flex items-center gap-1 pb-1 text-[13px] text-mist-500"
      >
        <LogOut size={14} /> 로그아웃 ({user?.username})
      </button>

      {/* 친구 추가 바텀시트 (라인/카톡식) */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-[430px] rounded-t-[24px] border-t border-white/10 bg-night-800 p-5 pb-8">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="text-[17px] font-extrabold">ID로 친구 추가</h3>
            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <Field
                  label="상대방 아이디"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="username"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void doSearch();
                  }}
                />
              </div>
              <button
                onClick={() => void doSearch()}
                aria-label="검색"
                className="mt-[26px] flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-mint-400 text-[#052e1b]"
              >
                <Search size={20} />
              </button>
            </div>
            {msg && <p className="mt-2 text-[13px] text-amber-300">{msg}</p>}
            <div className="mt-3 max-h-56 space-y-2 overflow-auto">
              {results.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-night-900 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-night-700 font-extrabold">
                    {u.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 text-[15px] font-bold">{u.username}</span>
                  <button
                    onClick={async () => {
                      try {
                        await friendsApi.send(u.username);
                        setMsg(`${u.username}님에게 요청을 보냈습니다`);
                        setResults([]);
                        setQuery('');
                        void load();
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : '요청 실패');
                      }
                    }}
                    className="flex items-center gap-1 rounded-xl bg-mint-400 px-3 py-2 text-[13px] font-bold text-[#052e1b]"
                  >
                    <UserPlus size={15} /> 추가
                  </button>
                </div>
              ))}
              {searched && results.length === 0 && (
                <p className="py-3 text-center text-[13px] text-mist-500">검색 결과가 없습니다.</p>
              )}
            </div>
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => {
                setShowAdd(false);
                setSearched(false);
              }}
            >
              닫기
            </Button>
          </div>
        </div>
      )}
    </Shell>
  );
}
