/**
 * @vitest-environment jsdom
 *
 * Test TemplatePicker (GOAL v154 fase ii): render kartu seed template di
 * onboarding. Fokus perilaku kontrak: jumlah kartu default, testid unik per
 * templateId, onSelect tepat satu kali dengan objek template, kartu invalid
 * disabled dengan title berisi alasan validasi, dukungan props custom.
 * Asersi fungsional saja, tanpa asersi class layout agar tahan refactor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TemplatePicker } from './TemplatePicker';
import { SEED_TEMPLATES, type SeedTemplate } from '../../lib/onboarding/seedTemplates';

const invalidTemplate: SeedTemplate = {
  templateId: 'invalid-1',
  nama: 'Template Invalid',
  deskripsi: 'Contoh struktur rusak untuk kasus disabled.',
  persons: [
    { id: 'x1', nama: 'A', gender: 'M', parentLinks: ['takada'], childLinks: [], pasangan: null },
  ],
};

describe('TemplatePicker', () => {
  beforeEach(() => {
    cleanup();
  });

  it('merender 3 kartu default dari SEED_TEMPLATES', () => {
    const { container } = render(<TemplatePicker onSelect={vi.fn()} />);
    const cards = container.querySelectorAll('[data-testid^="template-card-"]');
    expect(cards).toHaveLength(3);
    expect(screen.getByText('Keluarga Inti')).toBeTruthy();
    expect(screen.getByText('Tarombo (Batak)')).toBeTruthy();
    expect(screen.getByText('Zupu (Silsilah Klan)')).toBeTruthy();
  });

  it('memberi data-testid unik per templateId', () => {
    const { container } = render(<TemplatePicker onSelect={vi.fn()} />);
    const ids = Array.from(container.querySelectorAll('[data-testid^="template-card-"]')).map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain('template-card-keluarga-inti');
    expect(ids).toContain('template-card-tarombo-batak');
    expect(ids).toContain('template-card-zupu');
  });

  it('klik kartu memanggil onSelect tepat satu kali dengan objek template', () => {
    const onSelect = vi.fn();
    render(<TemplatePicker onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('template-card-keluarga-inti'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(SEED_TEMPLATES[0]);
  });

  it('tidak memanggil onSelect sebelum ada klik', () => {
    const onSelect = vi.fn();
    render(<TemplatePicker onSelect={onSelect} />);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('template dengan validasi tidak kosong dirender disabled', () => {
    render(<TemplatePicker templates={[invalidTemplate]} onSelect={vi.fn()} />);
    const card = screen.getByTestId('template-card-invalid-1') as HTMLButtonElement;
    expect(card.disabled).toBe(true);
  });

  it('klik kartu disabled tidak memanggil onSelect', () => {
    const onSelect = vi.fn();
    render(<TemplatePicker templates={[invalidTemplate]} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('template-card-invalid-1'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('props templates custom dirender sesuai jumlah', () => {
    const custom: SeedTemplate[] = [SEED_TEMPLATES[0], invalidTemplate];
    const { container } = render(<TemplatePicker templates={custom} onSelect={vi.fn()} />);
    const cards = container.querySelectorAll('[data-testid^="template-card-"]');
    expect(cards).toHaveLength(2);
    expect(screen.getByTestId('template-card-keluarga-inti')).toBeTruthy();
    expect(screen.getByTestId('template-card-invalid-1')).toBeTruthy();
  });

  it('title kartu invalid berisi pesan alasan validasi', () => {
    render(<TemplatePicker templates={[invalidTemplate]} onSelect={vi.fn()} />);
    const card = screen.getByTestId('template-card-invalid-1');
    const title = card.getAttribute('title') ?? '';
    expect(title).toContain('tak dikenal');
    expect(title).toContain('x1');
  });
});
