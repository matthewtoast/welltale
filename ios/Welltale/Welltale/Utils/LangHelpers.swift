import Foundation

func stringToLangLocale(_ input: String) -> LangLocale {
    let normalized = input.lowercased().replacingOccurrences(of: "-", with: "_")
    let parts = normalized.split(separator: "_")
    switch parts[0] {
    case "en": return .en_us
    case "es": return .es_es
    case "zh": return .zh_cn
    case "fr": return .fr_fr
    case "de": return .de_de
    case "it": return .it_it
    case "ja": return .ja_jp
    case "ko": return .ko_kr
    case "ru": return .ru_ru
    case "pt": return .pt_pt
    case "nl": return .nl_nl
    case "ar": return .ar_sa
    case "sv": return .sv_se
    case "nb": return .nb_no
    case "da": return .da_dk
    case "fi": return .fi_fi
    case "pl": return .pl_pl
    case "tr": return .tr_tr
    case "cs": return .cs_cz
    case "hu": return .hu_hu
    case "el": return .el_gr
    case "th": return .th_th
    case "yue": return .yue_hk
    case "hi": return .hi_in
    case "id": return .id_id
    case "ms": return .ms_my
    case "he": return .he_il
    case "af": return .af_za
    case "ro": return .ro_ro
    default: return LangLocale.en_us
    }
}

func langLocaleToString(_ locale: LangLocale) -> String {
    let parts = locale.rawValue.split(separator: "_")
    let lang = parts[0].lowercased()
    let loc = parts[1].uppercased()
    return "\(lang)-\(loc)"
}

func stringToLangFlag(_ input: String) -> String {
    let locale = stringToLangLocale(input)
    return langLocaleToFlag(locale)
}

func langLocaleToFlag(_ ll: LangLocale) -> String {
    return KNOWN_LOCALES[ll]!.flag
}

func langLocaleToName(_ ll: LangLocale) -> String {
    return KNOWN_LOCALES[ll]!.name
}

func langLocaleToShortCode(_ ll: LangLocale) -> String {
    return KNOWN_LOCALES[ll]!.lang
}

enum LangLocale: String, Codable, CaseIterable {
    case en_us
    case es_es
    case zh_cn
    case zh_tw
    case fr_fr
    case de_de
    case it_it
    case ja_jp
    case ko_kr
    case ru_ru
    case pt_pt
    case nl_nl
    case ar_sa
    case sv_se
    case nb_no
    case da_dk
    case fi_fi
    case pl_pl
    case tr_tr
    case cs_cz
    case hu_hu
    case el_gr
    case th_th
    case yue_hk
    case hi_in
    case id_id
    case ms_my
    case he_il
    case af_za
    case ro_ro
}


let KNOWN_LOCALES: [LangLocale: LangLocaleSpec] = [
    .en_us: LangLocaleSpec(id: .en_us, lang: "en", loc: "US", name: "English", flag: "🇺🇸"),
    .es_es: LangLocaleSpec(id: .es_es, lang: "es", loc: "ES", name: "Spanish", flag: "🇪🇸"),
    .zh_cn: LangLocaleSpec(id: .zh_cn, lang: "zh", loc: "CN", name: "Simplified Mandarin", flag: "🇨🇳"),
    .zh_tw: LangLocaleSpec(id: .zh_tw, lang: "zh", loc: "TW", name: "Traditional Mandarin", flag: "🇹🇼"),
    .fr_fr: LangLocaleSpec(id: .fr_fr, lang: "fr", loc: "FR", name: "French", flag: "🇫🇷"),
    .de_de: LangLocaleSpec(id: .de_de, lang: "de", loc: "DE", name: "German", flag: "🇩🇪"),
    .it_it: LangLocaleSpec(id: .it_it, lang: "it", loc: "IT", name: "Italian", flag: "🇮🇹"),
    .ja_jp: LangLocaleSpec(id: .ja_jp, lang: "ja", loc: "JP", name: "Japanese", flag: "🇯🇵"),
    .ko_kr: LangLocaleSpec(id: .ko_kr, lang: "ko", loc: "KR", name: "Korean", flag: "🇰🇷"),
    .ru_ru: LangLocaleSpec(id: .ru_ru, lang: "ru", loc: "RU", name: "Russian", flag: "🇷🇺"),
    .pt_pt: LangLocaleSpec(id: .pt_pt, lang: "pt", loc: "PT", name: "Portuguese", flag: "🇵🇹"),
    .nl_nl: LangLocaleSpec(id: .nl_nl, lang: "nl", loc: "NL", name: "Dutch", flag: "🇳🇱"),
    .ar_sa: LangLocaleSpec(id: .ar_sa, lang: "ar", loc: "SA", name: "Arabic", flag: "🇸🇦"),
    .sv_se: LangLocaleSpec(id: .sv_se, lang: "sv", loc: "SE", name: "Swedish", flag: "🇸🇪"),
    .nb_no: LangLocaleSpec(id: .nb_no, lang: "nb", loc: "NO", name: "Norwegian", flag: "🇳🇴"),
    .da_dk: LangLocaleSpec(id: .da_dk, lang: "da", loc: "DK", name: "Danish", flag: "🇩🇰"),
    .fi_fi: LangLocaleSpec(id: .fi_fi, lang: "fi", loc: "FI", name: "Finnish", flag: "🇫🇮"),
    .pl_pl: LangLocaleSpec(id: .pl_pl, lang: "pl", loc: "PL", name: "Polish", flag: "🇵🇱"),
    .tr_tr: LangLocaleSpec(id: .tr_tr, lang: "tr", loc: "TR", name: "Turkish", flag: "🇹🇷"),
    .cs_cz: LangLocaleSpec(id: .cs_cz, lang: "cs", loc: "CZ", name: "Czech", flag: "🇨🇿"),
    .hu_hu: LangLocaleSpec(id: .hu_hu, lang: "hu", loc: "HU", name: "Hungarian", flag: "🇭🇺"),
    .el_gr: LangLocaleSpec(id: .el_gr, lang: "el", loc: "GR", name: "Greek", flag: "🇬🇷"),
    .th_th: LangLocaleSpec(id: .th_th, lang: "th", loc: "TH", name: "Thai", flag: "🇹🇭"),
    .yue_hk: LangLocaleSpec(id: .yue_hk, lang: "yue", loc: "HK", name: "Cantonese", flag: "🇭🇰"),
    .hi_in: LangLocaleSpec(id: .hi_in, lang: "hi", loc: "IN", name: "Hindi", flag: "🇮🇳"),
    .id_id: LangLocaleSpec(id: .id_id, lang: "id", loc: "ID", name: "Indonesian", flag: "🇮🇩"),
    .ms_my: LangLocaleSpec(id: .ms_my, lang: "ms", loc: "MY", name: "Malay", flag: "🇲🇾"),
    .he_il: LangLocaleSpec(id: .he_il, lang: "he", loc: "IL", name: "Hebrew", flag: "🇮🇱"),
    .af_za: LangLocaleSpec(id: .af_za, lang: "af", loc: "ZA", name: "Afrikaans", flag: "🇿🇦"),
    .ro_ro: LangLocaleSpec(id: .ro_ro, lang: "ro", loc: "RO", name: "Romanian", flag: "🇷🇴")
]

struct LangLocaleSpec {
    let id: LangLocale
    let lang: String
    let loc: String
    let name: String
    let flag: String
}

func getLangName(_ ll: LangLocale) -> String {
    return KNOWN_LOCALES[ll]!.name
}

func localeEqsLang(_ locale: LangLocale, _ lang: String) -> Bool {
    let normalizedString = lang.replacingOccurrences(of: "-", with: "_").lowercased()
    let components = normalizedString.split(separator: "_")
    if components.count == 1 {
        return locale.rawValue.hasPrefix(normalizedString)
    }
    if components.count == 2 {
        return locale.rawValue == normalizedString
    }
    return false
}

let NONLATIN_LANGS: [LangLocale] = [
    .ja_jp,
    .zh_cn,
    .zh_tw,
    .ko_kr,
    .ru_ru,
    .ar_sa,
    .el_gr,
    .th_th,
    .yue_hk,
    .hi_in,
    .he_il,
]

func isNonLatin(_ ll: LangLocale) -> Bool {
    return NONLATIN_LANGS.contains(ll)
}
