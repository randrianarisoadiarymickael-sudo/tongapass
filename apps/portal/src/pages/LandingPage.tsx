import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { LogoMark, Wordmark } from '@/components/brand/Logo';
import { IconKey, IconLock, IconMoon, IconSun, IconFlow, IconShieldCheck, IconPause, IconPlay } from '@/components/icons';
import { AccessPassExample } from '@/components/landing/AccessPassExample';
import { FlowDiagram } from '@/components/landing/FlowDiagram';
import { Button, IconButton } from '@/components/ui/Button';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useVisiblePlayback } from '@/hooks/useVisiblePlayback';
import { useTheme } from '@/hooks/useTheme';

const SAFEGUARDS = [
  { title: 'Qui peut modifier les accès ?', text: 'Les équipes RH et les administrateurs lancent les opérations depuis le portail. Le profil de poste définit les droits de départ. Toute exception doit être justifiée.' },
  { title: 'Comment retrouver une opération ?', text: 'Le journal d’audit conserve l’acteur, la date et le détail de chaque opération. Les entrées sont chaînées par empreinte SHA-256 et exportables au format CSV.' },
  { title: 'Comment repérer un droit en trop ?', text: 'Chaque nuit, un compte de service en lecture seule compare les droits Keycloak au profil attendu. Les écarts apparaissent dans la page Conformité.' },
];

export function LandingPage() {
  const { login } = useAuth();
  const { resolved, toggle } = useTheme();
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const enabled = !reduced && !paused;
  const { ref: heroRef, playing: heroPlaying } = useVisiblePlayback<HTMLElement>(enabled);
  const enter = () => void login(window.location.pathname + window.location.search);

  return (
    <div id="haut" className="landing">
      <a className="landing-skip" href="#main">Aller au contenu</a>
      <header className="landing-header">
        <div className="landing-wrap flex min-h-[4.5rem] items-center gap-5">
          <a href="#haut" className="flex items-center gap-2" aria-label="TongaPass, haut de page"><LogoMark /><Wordmark /></a>
          <nav aria-label="Sections de la page" className="ml-auto hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#cycle">Parcours RH</a><a href="#architecture">Architecture</a><a href="#securite">Sécurité</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-6">
            {!reduced && <IconButton label={paused ? 'Reprendre les animations' : 'Mettre les animations en pause'} onClick={() => setPaused(!paused)}>
              {paused ? <IconPlay className="size-[18px]" /> : <IconPause className="size-[18px]" />}
            </IconButton>}
            <IconButton label={resolved === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'} onClick={toggle}>
              {resolved === 'dark' ? <IconSun className="size-5" /> : <IconMoon className="size-5" />}
            </IconButton>
            <Button variant="secondary" onClick={enter}>Se connecter</Button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="outline-none">
        <section ref={heroRef} className="landing-hero" data-playing={heroPlaying} aria-labelledby="hero-title">
          <div className="hero-image" aria-hidden="true" />
          <div className="landing-wrap hero-inner"><div className="hero-copy">
            <p className="hero-kicker"><IconKey aria-hidden="true" /> Gestion des identités</p>
            <h1 id="hero-title">Gérez les accès<br /><span>de vos équipes.</span></h1>
            <p className="hero-description">De l’arrivée au départ, ouvrez les comptes, ajustez les droits et suivez chaque opération en temps réel.</p>
            <div className="hero-actions">
              <Button variant="primary" size="lg" onClick={enter} icon={<IconLock className="size-4" aria-hidden="true" />}>Se connecter avec Keycloak</Button>
              <a href="#cycle"><IconFlow aria-hidden="true" /> Voir la démo</a>
            </div>
          </div></div>
        </section>
        <div className="landing-wrap demo-wrap">
          <AccessPassExample enabled={enabled} reduced={reduced} />
        </div>
        <section id="architecture" className="landing-wrap landing-section" aria-labelledby="architecture-title">
          <div className="architecture-intro">
            <h2 className="section-title" id="architecture-title">Comment circulent les accès&nbsp;?</h2>
            <p className="section-intro">Le portail transmet la demande à n8n. Chaque outil applique les changements et l’API enregistre leur résultat.</p>
          </div>
          <FlowDiagram enabled={enabled} />
        </section>
        <section id="securite" className="landing-wrap security-section" aria-labelledby="security-title">
          <h2 className="section-title" id="security-title"><IconShieldCheck className="mb-3 size-8 text-brand" />Contrôle des accès</h2>
          <div>{SAFEGUARDS.map(({ title, text }) => (
            <details className="security-item" key={title}>
              <summary>{title}<span aria-hidden="true" /></summary><p>{text}</p>
            </details>
          ))}</div>
        </section>
      </main>
      <footer className="landing-wrap flex flex-wrap items-center justify-between gap-4 border-t border-line py-6 text-sm text-ink-3">
        <span className="flex items-center gap-2"><IconKey className="size-5" aria-hidden="true" /> TongaPass</span>
        <span>Projet P03 · ESTI Licence 3 · 2026</span>
      </footer>
    </div>
  );
}
