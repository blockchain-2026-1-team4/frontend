import { Alert, Platform } from 'react-native';

type DialogAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

function webMessage(title: string, message?: string) {
  return message ? `${title}\n\n${message}` : title;
}

function browserDialog() {
  return globalThis as typeof globalThis & {
    alert?: (message?: string) => void;
    confirm?: (message?: string) => boolean;
    document?: Document;
  };
}

export function showDialog(title: string, message?: string, actions?: DialogAction[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, actions);
    return;
  }

  const dialog = browserDialog();
  if (dialog.document) {
    showWebDialog(dialog.document, title, message, actions);
    return;
  }

  const hasChoice = actions && actions.length > 1;
  if (!hasChoice) {
    dialog.alert?.(webMessage(title, message));
    actions?.[0]?.onPress?.();
    return;
  }

  const cancelAction = actions.find((action) => action.style === 'cancel');
  const confirmAction = [...actions].reverse().find((action) => action.style !== 'cancel');
  const confirmed = dialog.confirm?.(webMessage(title, message)) ?? false;
  if (confirmed) {
    confirmAction?.onPress?.();
  } else {
    cancelAction?.onPress?.();
  }
}

function showWebDialog(document: Document, title: string, message?: string, actions?: DialogAction[]) {
  document.getElementById('trustticket-dialog-root')?.remove();

  const root = document.createElement('div');
  root.id = 'trustticket-dialog-root';
  root.setAttribute('role', 'presentation');
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:22px',
    'background:rgba(15,23,42,0.48)',
    'backdrop-filter:blur(8px)',
    '-webkit-backdrop-filter:blur(8px)',
  ].join(';');

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.style.cssText = [
    'width:min(440px,100%)',
    'max-height:calc(100vh - 48px)',
    'overflow:hidden',
    'border-radius:24px',
    'background:#ffffff',
    'box-shadow:0 24px 80px rgba(15,23,42,0.28)',
    'border:1px solid rgba(226,232,240,0.9)',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');

  const body = document.createElement('div');
  body.style.cssText = 'padding:24px 24px 18px';

  const eyebrow = document.createElement('div');
  eyebrow.textContent = dialogTone(title);
  eyebrow.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'height:26px',
    'padding:0 10px',
    'border-radius:999px',
    'background:#F1F5F9',
    'color:#475569',
    'font-size:12px',
    'font-weight:800',
    'margin-bottom:14px',
  ].join(';');

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'color:#0F172A;font-size:22px;font-weight:900;line-height:1.24;letter-spacing:0;margin-bottom:10px';

  const content = document.createElement('div');
  content.textContent = message || '';
  content.style.cssText = [
    'white-space:pre-wrap',
    'overflow-wrap:anywhere',
    'color:#475569',
    'font-size:14px',
    'font-weight:650',
    'line-height:1.58',
    'max-height:42vh',
    'overflow:auto',
  ].join(';');

  body.append(eyebrow, heading);
  if (message) body.append(content);

  const footer = document.createElement('div');
  footer.style.cssText = [
    'display:flex',
    'gap:10px',
    'justify-content:flex-end',
    'padding:14px 18px 18px',
    'border-top:1px solid #E2E8F0',
    'background:#F8FAFC',
  ].join(';');

  const effectiveActions = actions?.length ? actions : [{ text: '확인' }];
  const close = (action?: DialogAction) => {
    root.remove();
    action?.onPress?.();
  };

  effectiveActions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.text;
    const primary = action.style !== 'cancel' && action.style !== 'destructive';
    const destructive = action.style === 'destructive';
    button.style.cssText = [
      'appearance:none',
      'border:0',
      'height:44px',
      'min-width:92px',
      'padding:0 18px',
      'border-radius:16px',
      'font-size:14px',
      'font-weight:900',
      'cursor:pointer',
      'letter-spacing:0',
      primary ? 'background:#534AB7;color:#FFFFFF' : destructive ? 'background:#FEE2E2;color:#B91C1C' : 'background:#FFFFFF;color:#334155;border:1px solid #CBD5E1',
    ].join(';');
    button.onmouseenter = () => { button.style.filter = 'brightness(0.98)'; };
    button.onmouseleave = () => { button.style.filter = 'none'; };
    button.onclick = () => close(action);
    footer.append(button);
  });

  panel.append(body, footer);
  root.append(panel);
  root.onclick = (event) => {
    if (event.target === root) {
      const cancelAction = effectiveActions.find((action) => action.style === 'cancel');
      close(cancelAction);
    }
  };
  document.addEventListener('keydown', function onKey(event) {
    if (event.key !== 'Escape') return;
    document.removeEventListener('keydown', onKey);
    const cancelAction = effectiveActions.find((action) => action.style === 'cancel');
    close(cancelAction);
  });
  document.body.append(root);
}

function dialogTone(title: string) {
  if (/실패|오류|불가|필요|거부|취소/.test(title)) return '확인 필요';
  if (/완료|성공/.test(title)) return '처리 완료';
  return 'TrustTicket';
}
