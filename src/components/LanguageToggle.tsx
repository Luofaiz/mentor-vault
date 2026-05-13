import { Languages } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-2 py-1 shadow-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600">
        <Languages className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setLocale('zh')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${locale === 'zh' ? 'bg-ink text-white' : 'text-stone-500 hover:bg-stone-100'}`}
        >
          {t('chinese')}
        </button>
        <button
          onClick={() => setLocale('en')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${locale === 'en' ? 'bg-ink text-white' : 'text-stone-500 hover:bg-stone-100'}`}
        >
          {t('english')}
        </button>
      </div>
    </div>
  );
}
