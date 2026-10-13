import { BusinessData } from './types';
import { resolveSmartTab } from './queryBuilder';

export type LeadStatus =
  | 'New'
  | 'Sent'
  | 'Pending'
  | 'Interested'
  | 'Deal Closed'
  | 'Denied'
  | 'Invalid Phone'
  | 'No Phone';

export interface PhoneValidationResult {
  raw: string | null;
  isValidMobile: boolean;
  isLandline: boolean;
  formattedPhone: string | null; // e.g. +962791234567
  wppPhone: string | null;       // e.g. 962791234567 (for WPPConnect)
  statusTag: 'New' | 'Invalid Phone' | 'No Phone';
  reason: string;
}

export interface ProcessedLead {
  status: LeadStatus;
  business_name: string;
  phone_number: string;
  wpp_phone: string;
  category: string;
  tab_name: string;
  zone: string;
  rating: string;
  reviews_count: string;
  website: string;
  place_url: string;
  sent_at: string;
  businessman_notes: string;
  place_id: string;
  is_eligible_for_whatsapp: boolean;
}

/**
 * Validates and normalizes Jordanian phone numbers.
 * Handles all formats:
 * - 96279..., 96278..., 96277...
 * - +96279..., +96278..., +96277...
 * - +962079..., +962078..., +962077...
 * - 079..., 078..., 077...
 * - 79..., 78..., 77...
 * - Landlines (06, 02, etc.) are flagged as Invalid Phone for WhatsApp campaigns.
 */
export function cleanJordanianPhone(rawInput: string | number | null | undefined): PhoneValidationResult {
  if (rawInput === null || rawInput === undefined || String(rawInput).trim() === '') {
    return {
      raw: null,
      isValidMobile: false,
      isLandline: false,
      formattedPhone: null,
      wppPhone: null,
      statusTag: 'No Phone',
      reason: 'No phone number provided on Google Maps'
    };
  }

  const raw = String(rawInput);

  // Convert Arabic-Indic numerals (٠-٩) to standard ASCII digits (0-9)
  const normalizedRaw = raw.trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  // Strip all characters except digits and plus
  const cleaned = normalizedRaw.replace(/[^\d+]/g, '');
  let digits = cleaned.replace(/^\+/, '');

  // Strip country prefix (00962 or 962)
  if (digits.startsWith('00962')) {
    digits = digits.substring(5);
  } else if (digits.startsWith('962')) {
    digits = digits.substring(3);
  }

  // Remove leading 0 if it's a mobile (e.g. 079... -> 79... or 078... -> 78...)
  if (digits.startsWith('07')) {
    digits = digits.substring(1);
  }

  // Jordanian Mobile Pattern: Starts with 7[7,8,9] followed by 7 digits (Total: 9 digits)
  // e.g. 795922787, 780854000, 778851517
  const isJordanMobile = /^7[789]\d{7}$/.test(digits) || /^7\d{8}$/.test(digits);

  if (isJordanMobile) {
    const formattedPhone = '+962' + digits;
    const wppPhone = '962' + digits;
    return {
      raw,
      isValidMobile: true,
      isLandline: false,
      formattedPhone,
      wppPhone,
      statusTag: 'New',
      reason: 'Valid Jordanian mobile number'
    };
  }

  // Check for Jordanian Landline (06 Amman, 02, 03, 05)
  if (/^0[2356]/.test(digits)) {
    digits = digits.substring(1);
  }

  const isJordanLandline = /^[2356]\d{6,7}$/.test(digits);
  if (isJordanLandline) {
    return {
      raw,
      isValidMobile: false,
      isLandline: true,
      formattedPhone: '+962' + digits,
      wppPhone: null,
      statusTag: 'Invalid Phone',
      reason: 'Landline number (cannot receive WhatsApp messages)'
    };
  }

  // Fallback: If it is an 8-14 digit number, still allow it as mobile
  if (/^\d{8,14}$/.test(digits)) {
    const wppPhone = digits.startsWith('962') ? digits : '962' + digits;
    return {
      raw,
      isValidMobile: true,
      isLandline: false,
      formattedPhone: '+' + wppPhone,
      wppPhone,
      statusTag: 'New',
      reason: 'Valid mobile number'
    };
  }

  return {
    raw,
    isValidMobile: false,
    isLandline: false,
    formattedPhone: raw,
    wppPhone: null,
    statusTag: 'Invalid Phone',
    reason: 'Invalid or malformed phone number'
  };
}

/**
 * Normalizes all Arabic-Indic and Persian numerals to standard English/ASCII digits (0-9).
 */
export function toEnglishDigits(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
}

/**
 * Converts a raw business item into a fully validated and normalized lead
 */
export function processLead(
  business: BusinessData,
  category: string,
  tabName: string
): ProcessedLead {
  const phoneVal = cleanJordanianPhone(business.phone_number);
  const rawCat = business.category || category;

  // Route Invalid Phone or No Phone directly to 'Invalid Numbers' tab
  const smartTab =
    phoneVal.statusTag === 'Invalid Phone' || phoneVal.statusTag === 'No Phone'
      ? 'Invalid Numbers'
      : resolveSmartTab(rawCat, tabName);

  return {
    status: phoneVal.statusTag,
    business_name: toEnglishDigits(business.business_name || 'Unnamed Business'),
    phone_number: phoneVal.formattedPhone || toEnglishDigits(business.phone_number ?? ''),
    wpp_phone: phoneVal.wppPhone || '',
    category: toEnglishDigits(rawCat),
    tab_name: smartTab,
    zone: toEnglishDigits(business.address || 'عمان، الأردن'),
    rating: business.rating !== null && !isNaN(business.rating) ? toEnglishDigits(String(business.rating)) : '',
    reviews_count: business.reviews_count !== null && !isNaN(business.reviews_count) ? toEnglishDigits(String(business.reviews_count)) : '',
    website: business.website || '',
    place_url: business.place_url || '',
    sent_at: '',
    businessman_notes: '',
    place_id: business.place_id || '',
    is_eligible_for_whatsapp: phoneVal.isValidMobile
  };
}
