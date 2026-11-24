import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmployeeStatusBadge, RunStatusBadge } from './Badge';

describe('Badges de statut', () => {
  it('affiche un libellé textuel (jamais la couleur seule)', () => {
    render(<EmployeeStatusBadge status="OFFBOARDING_SCHEDULED" />);
    expect(screen.getByText('Départ planifié')).toBeInTheDocument();
  });

  it('traduit les statuts d’exécution', () => {
    render(<RunStatusBadge status="PARTIAL" />);
    expect(screen.getByText('Partielle')).toBeInTheDocument();
  });
});
