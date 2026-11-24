export function normalizePhoneForWhatsApp(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Strip international dialing prefix "00"
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Convert local Pakistani numbers starting with 0 (e.g., 03001234567 -> 923001234567)
  if (digits.startsWith('0') && digits.length >= 9) {
    digits = `92${digits.slice(1)}`;
  }

  // Short emergency codes (e.g., 1122, 115, 1020, 1030) don't map to direct wa.me numbers
  if (digits.length < 7) {
    return null;
  }

  return digits;
}

export function buildWhatsAppUrl(phone: string | undefined, message: string): string {
  const normalized = normalizePhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  if (normalized) {
    return `https://wa.me/${normalized}?text=${encodedMessage}`;
  }
  return `https://wa.me/?text=${encodedMessage}`;
}

export function buildEmergencyWhatsAppMessage(opts: {
  recipientName?: string;
  areaName?: string;
  city?: string;
  lat?: number;
  lng?: number;
  hospitalName?: string;
  isCrashActive?: boolean;
}): string {
  const coordsText =
    typeof opts.lat === 'number' && typeof opts.lng === 'number'
      ? `https://maps.google.com/?q=${opts.lat.toFixed(5)},${opts.lng.toFixed(5)}`
      : '';
  const area = [opts.areaName, opts.city].filter(Boolean).join(', ');

  if (opts.isCrashActive) {
    return [
      `🚨 FARISHTA EMERGENCY ALERT${opts.recipientName ? ` for ${opts.recipientName}` : ''}:`,
      `Possible bike accident detected${area ? ` near ${area}` : ''}.`,
      opts.hospitalName ? `Nearest ER Target: ${opts.hospitalName}.` : '',
      coordsText ? `Live GPS Location: ${coordsText}` : '',
      `Please respond or coordinate with Rescue 1122.`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    `Hello${opts.recipientName ? ` ${opts.recipientName}` : ''}, reaching out via FARISHTA App.`,
    area ? `My current area: ${area}.` : '',
    coordsText ? `Live GPS Location: ${coordsText}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
