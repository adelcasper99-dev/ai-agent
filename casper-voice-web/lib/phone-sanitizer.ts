/**
 * Egyptian Phone Sanitizer & Identity Normalizer
 * Standardizes Egyptian mobile numbers into international E.164 format (+201XXXXXXXXX)
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  operator: 'Vodafone' | 'Orange' | 'Etisalat' | 'WE' | 'Unknown' | null;
  error?: string;
}

export function sanitizeEgyptianPhone(rawPhone: string | null | undefined): PhoneValidationResult {
  if (!rawPhone) {
    return { isValid: false, normalized: null, operator: null, error: 'رقم الهاتف فارغ.' };
  }

  // Remove spaces, dashes, parentheses, and leading zeros
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\+]/g, '');

  // Handle leading international country code '20'
  if (cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }

  // Handle local 11-digit numbers starting with 01
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Validation: Must be 10 digits starting with 10, 11, 12, or 15
  if (!/^1[0125]\d{8}$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: null,
      operator: null,
      error: 'رقم الهاتف غير صحيح. يجب أن يكون رقم موبايل مصري صحيح (فودافون، أورانج، اتصالات، وي).',
    };
  }

  const prefix = cleaned.substring(0, 2);
  let operator: 'Vodafone' | 'Orange' | 'Etisalat' | 'WE' = 'Vodafone';

  switch (prefix) {
    case '10':
      operator = 'Vodafone';
      break;
    case '12':
      operator = 'Orange';
      break;
    case '11':
      operator = 'Etisalat';
      break;
    case '15':
      operator = 'WE';
      break;
  }

  const normalized = `+20${cleaned}`;

  return {
    isValid: true,
    normalized,
    operator,
  };
}
