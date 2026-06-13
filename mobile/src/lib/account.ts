import type { UserProfile } from '../types/api';
import { hasOrganizerAccess } from './roles';

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

  return hasOrganizerAccess(profile.roles) ? 'Organizer' : 'Main';
}

export function errorMessage(error: any, fallback = '요청을 처리하지 못했습니다.') {
  const serverMessage = error?.response?.data?.message;
  const status = error?.response?.status;
  const contractMessage = blockchainErrorMessage(error);

  if (contractMessage) return contractMessage;

  if (!error?.response && (error?.request || error?.message === 'Network Error' || error?.code === 'ERR_NETWORK')) {
    return '서버에 연결할 수 없습니다. PC와 휴대폰이 같은 Wi-Fi인지, API 주소가 올바른지 확인해 주세요. Windows 방화벽, VPN, 학교/회사 Wi-Fi의 기기 간 통신 차단도 확인해 주세요.';
  }

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

function blockchainErrorMessage(error: any) {
  const text = stringifyError(error);
  const rejectedCode = error?.code ?? error?.error?.code ?? error?.info?.error?.code;
  if (rejectedCode === 4001 || rejectedCode === '4001') return '지갑에서 요청을 취소했습니다.';

  if (text.includes('0x0ce9b082') || /MembershipPassRequired/i.test(text)) {
    return '팬클럽 멤버십 NFT가 필요한 선예매입니다. 현재 연결된 지갑에 FanClubMembership NFT가 있는지 확인해주세요.';
  }
  if (text.includes('0x00bfc921') || /InvalidPrice/i.test(text)) {
    return '결제 금액이 컨트랙트의 티켓 가격과 일치하지 않습니다. 이벤트 가격 또는 선예매 가격 설정을 다시 확인해주세요.';
  }
  if (text.includes('0xbf17eae7') || /PrimarySaleClosed/i.test(text)) {
    return '현재는 1차 판매 기간이 아닙니다. 판매 시작/종료 시간을 확인해주세요.';
  }
  if (text.includes('0xd2dec26d') || /TicketUnavailable/i.test(text)) {
    return '이미 판매되었거나 현재 구매할 수 없는 티켓입니다. 목록을 새로고침한 뒤 다른 좌석을 선택해주세요.';
  }
  if (text.includes('0x9fe5276f') || /EventInactive/i.test(text)) {
    return '현재 판매가 비활성화된 이벤트입니다.';
  }
  if (text.includes('0x377e2476') || /TicketUsedError/i.test(text)) {
    return '이미 사용 처리된 티켓입니다.';
  }
  if (text.includes('0xa3e0b8f8') || /TicketListedError/i.test(text)) {
    return '이미 리셀 등록된 티켓입니다.';
  }
  if (text.includes('0x810074be') || /AlreadyMember/i.test(text)) {
    return '이 지갑은 이미 FanClubMembership NFT를 보유하고 있습니다.';
  }
  if (text.includes('0xe2517d3f') || /AccessControlUnauthorizedAccount/i.test(text)) {
    return '이 작업을 실행할 컨트랙트 권한이 없습니다. 관리자, 주최자, 멤버십 발급자 권한이 있는 지갑인지 확인해주세요.';
  }
  if (/CALL_EXCEPTION|execution reverted|estimateGas|unknown custom error/i.test(text)) {
    return '블록체인 컨트랙트가 거래를 거부했습니다. 연결된 지갑, 티켓 상태, 판매 기간, 가격, 멤버십 보유 여부를 확인해주세요.';
  }
  return '';
}

function stringifyError(error: any) {
  const parts = [
    error?.message,
    error?.shortMessage,
    error?.data,
    error?.reason,
    error?.code,
    error?.error?.message,
    error?.error?.data,
    error?.info?.error?.message,
    error?.info?.error?.data,
  ].filter(Boolean);
  return parts.join(' ');
}
