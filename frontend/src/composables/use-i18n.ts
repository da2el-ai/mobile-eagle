import ja from '@/locales/ja';
import en from '@/locales/en';

// 自前の軽量 i18n（base.md 6 章）。vue-i18n は入れない。
// 言語はブラウザ表示言語から自動決定する（手動切り替え UI は設けない）。

const messages: Record<string, unknown> = { ja, en };

const lang: 'ja' | 'en' = (navigator.language || 'en').toLowerCase().startsWith('ja')
  ? 'ja'
  : 'en';

// ドット区切りキーで文言を引く。
const resolve = (dict: unknown, key: string): string | undefined => {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
};

// 現在言語 → ja フォールバック → キーそのもの、の順で返す。
const t = (key: string): string => resolve(messages[lang], key) ?? resolve(ja, key) ?? key;

// `{n}` のようなプレースホルダーを埋める（件数入りの文言用）。
// 語順が言語で変わるため、文字列連結ではなく文言側にプレースホルダーを置く。
const tf = (key: string, params: Record<string, string | number>): string =>
  Object.entries(params).reduce(
    (text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
    t(key),
  );

export function useI18n() {
  return { t, tf, lang };
}
