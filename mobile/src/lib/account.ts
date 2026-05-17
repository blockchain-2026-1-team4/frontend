import type { UserProfile } from '../types/api';

type EntryRole = 'USER' | 'ORGANIZER';

export function accountStatusMessage(status?: string) {
  if (status && status !== 'ACTIVE') {
    return '사용할 수 없는 계정입니다.';
  }
  return null;
}

export function isActiveProfile(profile?: UserProfile | null) {
  return profile?.status === undefined || profile.status === 'ACTIVE';
}

export function routeForEntry(profile: UserProfile, entryRole: EntryRole) {
  if (entryRole === 'USER') {
    return 'Main';
  }

  const roles = profile.roles ?? [];
  return roles.includes('ORGANIZER') || roles.includes('ADMIN') ? 'Organizer' : 'Organizer';
}

export function errorMessage(error: any, fallback = '요청을 처리하지 못했습니다.') {
  const serverMessage = error?.response?.data?.message;
  const status = error?.response?.status;

  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    if (
      serverMessage.includes('사용할 수 없는 계정') ||
      serverMessage.includes('정지') ||
      serverMessage.includes('비활성') ||
      serverMessage.includes('삭제')
    ) {
      return '사용할 수 없는 계정입니다.';
    }
    return serverMessage;
  }

  if (status === 401) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (status === 403) return '접근할 수 없는 계정이거나 권한이 없습니다.';
  return error?.message || fallback;
}
