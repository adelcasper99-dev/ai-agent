# voice_service/egyptian_number_normalizer.py
import re

UNITS = {
    0: "", 1: "واحد", 2: "اتنين", 3: "تلاتة", 4: "أربعة", 5: "خمسة",
    6: "ستة", 7: "سبعة", 8: "تمانية", 9: "تسعة", 10: "عشرة"
}

TEENS = {
    11: "حداشر", 12: "اطناشر", 13: "تلتاشر", 14: "أربعتاشر", 15: "خمسطاشر",
    16: "ستاشر", 17: "سبعتاشر", 18: "تمنتاشر", 19: "تسعتاشر"
}

TENS = {
    20: "عشرين", 30: "تلاتين", 40: "أربعين", 50: "خمسين",
    60: "ستين", 70: "سبعين", 80: "تمانين", 90: "تسعين"
}

HUNDREDS = {
    100: "مية", 200: "متين", 300: "تليتمية", 400: "أربعمية", 500: "خمسمية",
    600: "ستماية", 700: "سبعمية", 800: "تمنمية", 900: "تسعمية"
}

def number_to_egyptian_words(n: int) -> str:
    """Converts an integer (0 to 9999) into spoken Egyptian Arabic words."""
    if n == 0:
        return "صفر"
    
    parts = []
    
    # Thousands
    thousands = n // 1000
    remainder = n % 1000
    if thousands == 1:
        parts.append("ألف")
    elif thousands == 2:
        parts.append("ألفين")
    elif 3 <= thousands <= 10:
        parts.append(f"{UNITS[thousands]} تلاف")
    elif thousands > 10:
        parts.append(f"{number_to_egyptian_words(thousands)} ألف")
        
    n = remainder
    if n == 0:
        return " ".join(parts)
        
    # Hundreds
    hundreds = (n // 100) * 100
    n = n % 100
    if hundreds in HUNDREDS:
        parts.append(HUNDREDS[hundreds])
        
    if n == 0:
        return " ".join(parts)
        
    # Tens & Units
    if n <= 10:
        parts.append(UNITS[n])
    elif 11 <= n <= 19:
        parts.append(TEENS[n])
    else:
        u = n % 10
        t = (n // 10) * 10
        if u > 0:
            parts.append(f"{UNITS[u]} و{TENS[t]}")
        else:
            parts.append(TENS[t])
            
    return " ".join([p for p in parts if p])

def normalize_egyptian_numbers(text: str) -> str:
    """
    Normalizes numeric expressions and financial figures in text into 
    conversational Egyptian Spoken Arabic for high-quality TTS prosody.
    """
    if not text:
        return ""

    # Replace currency acronyms
    text = re.sub(r'\b(EGP|egp)\b', 'جنيه', text)

    # Replace decimal expressions like 15.5 or 25.50
    def replace_decimal(match):
        integer_part = int(match.group(1))
        decimal_part = match.group(2)
        int_words = number_to_egyptian_words(integer_part)
        
        if decimal_part in ["5", "50"]:
            return f"{int_words} جنيه ونص"
        elif decimal_part in ["25"]:
            return f"{int_words} جنيه وربع"
        elif decimal_part in ["75"]:
            return f"{int_words} جنيه وتلات أرباع"
        else:
            dec_val = int(decimal_part)
            dec_words = number_to_egyptian_words(dec_val)
            return f"{int_words} جنيه و{dec_words} قرش"

    text = re.sub(r'(\d+)\.(\d{1,2})\s*(جنيه)?', replace_decimal, text)

    # Replace integer numbers (1 to 9999)
    def replace_integer(match):
        num_str = match.group(0)
        num = int(num_str)
        if 0 <= num <= 9999:
            return number_to_egyptian_words(num)
        return num_str

    text = re.sub(r'\b\d{1,4}\b', replace_integer, text)

    return text
