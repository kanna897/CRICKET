import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  const t = useTranslations('Index');
  const locale = useLocale();

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-background text-foreground">
      <main className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-3xl">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          {t('title')}
        </h1>
        <p className="text-xl text-muted-foreground mb-12">
          {t('description')}
        </p>
        <Link 
          href={`/${locale}/admin`} 
          className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full shadow-lg hover:bg-primary/90 transition-all"
        >
          Go to Dashboard <ArrowRight className="w-5 h-5" />
        </Link>
      </main>
    </div>
  );
}
