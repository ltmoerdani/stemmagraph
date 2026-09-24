/**
 * TemplatePicker (GOAL v154 fase ii): pemilih seed template di flow onboarding.
 *
 * Komponen presentational murni: menerima daftar SeedTemplate (default
 * SEED_TEMPLATES dari lib/onboarding), merender satu kartu tombol per
 * template, dan melaporkan pilihan user lewat onSelect. Validasi struktur
 * didelegasikan ke validateSeedTemplate; template bermasalah dirender
 * disabled dengan title berisi gabungan alasan.
 */
import {
  SEED_TEMPLATES,
  validateSeedTemplate,
  type SeedTemplate,
} from '../../lib/onboarding/seedTemplates';

interface TemplatePickerProps {
  templates?: SeedTemplate[];
  onSelect: (t: SeedTemplate) => void;
}

export function TemplatePicker({ templates = SEED_TEMPLATES, onSelect }: TemplatePickerProps) {
  return (
    <div>
      {templates.map((t) => {
        const problems = validateSeedTemplate(t);
        const disabled = problems.length > 0;
        return (
          <button
            key={t.templateId}
            type="button"
            data-testid={`template-card-${t.templateId}`}
            disabled={disabled}
            title={disabled ? problems.join('; ') : undefined}
            onClick={() => onSelect(t)}
          >
            <span>{t.nama}</span>
            <span>{t.deskripsi}</span>
            <span>{t.persons.length} persons</span>
          </button>
        );
      })}
    </div>
  );
}
