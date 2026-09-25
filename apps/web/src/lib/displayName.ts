// 표시 이름 (게스트용). 로그인 유저는 username을 그대로 사용.
// 방 입장 때마다 입력하지 않도록 로컬에 저장.
const KEY = 'cp_display_name';

export function getDisplayName(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setDisplayName(name: string): void {
  try {
    if (name.trim()) localStorage.setItem(KEY, name.trim().slice(0, 20));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
