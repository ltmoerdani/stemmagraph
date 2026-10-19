import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, TreePine, MapPin } from 'lucide-react';
import { useFamilyStore } from '../../store/familyStore';
import { computeLivingStats, AGE_BUCKETS } from '../../lib/stats/living-stats';
import { computeAgeGroupsPBB, AGE_GROUPS_PBB } from '../../lib/stats/age-groups';
import { computeUpcomingBirthdays } from '../../lib/stats/upcoming-birthdays';
import { getStatsApi } from '../../lib/adapters';
import type { UpcomingAnniversaryDto } from '../../lib/adapters';
import type { FamilySizeStatsDto } from '../../lib/adapters';

/** Format YYYY-MM-DD ke tanggal pendek locale via Intl UTC (bebas geser hari zona). */
function formatYmdLocale(ymd: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!match) return ymd
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

export const StatsSidebar: React.FC = () => {
  const { stats, members } = useFamilyStore();
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);
  const { t, i18n } = useTranslation();
  const [anniversaryEntries, setAnniversaryEntries] = useState<UpcomingAnniversaryDto[]>([]);
  const [anniversariesLoaded, setAnniversariesLoaded] = useState(false);
  const [generationsCount, setGenerationsCount] = useState<number | null>(null);
  const [generationsLoaded, setGenerationsLoaded] = useState(false);
  const [familySizeStats, setFamilySizeStats] = useState<FamilySizeStatsDto | null>(null);
  const [familySizeLoaded, setFamilySizeLoaded] = useState(false);
  const [oldestLiving, setOldestLiving] = useState<OldestLivingEntryDto[] | null>(null);
  const [oldestLivingLoaded, setOldestLivingLoaded] = useState(false);

  const livingStats = useMemo(
    () =>
      computeLivingStats(
        members.map((member) => ({
          birthDate: member.birthDate,
          deathDate: member.deathDate ?? null,
          isAlive: member.isAlive,
          generation: member.generation,
        })),
      ),
    [members],
  );

  const ageGroups = useMemo(
    () =>
      computeAgeGroupsPBB(
        members.map((member) => ({
          birthDate: member.birthDate,
          isAlive: member.isAlive,
        })),
      ),
    [members],
  );

  const upcomingBirthdays = useMemo(
    () =>
      computeUpcomingBirthdays(
        members
          .filter((member) => member.isAlive === true)
          .map((member) => ({
            personId: member.id,
            displayName: member.name,
            birthDate: member.birthDate,
          })),
        new Date(),
        30,
      ),
    [members],
  );

  // Upcoming Anniversaries (v277 fase ii): data hidup di server v275,
  // bukan komputasi store klien. Adapter null (mock, supabase), treeId
  // kosong, fetch berjalan, atau fetch gagal berarti section tidak
  // dirender; tanpa mock data apa pun.
  useEffect(() => {
    const api = currentFamilyTreeId ? getStatsApi() : null;
    if (!currentFamilyTreeId || !api) return;
    let cancelled = false;
    setAnniversariesLoaded(false);
    api
      .listUpcomingAnniversaries(currentFamilyTreeId)
      .then((items) => {
        if (cancelled) return;
        setAnniversaryEntries(items);
        setAnniversariesLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setAnniversaryEntries([]);
        setAnniversariesLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFamilyTreeId]);

  // Generations count (v286): jumlah generasi hidup di server, sama pola
  // anniversaries. Adapter null (mock, supabase), treeId kosong, fetch
  // berjalan, atau fetch gagal berarti section tidak dirender.
  useEffect(() => {
    const api = currentFamilyTreeId ? getStatsApi() : null;
    if (!currentFamilyTreeId || !api) return;
    let cancelled = false;
    setGenerationsLoaded(false);
    api
      .getGenerationsCount(currentFamilyTreeId)
      .then((dto) => {
        if (cancelled) return;
        setGenerationsCount(dto.generationCount);
        setGenerationsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setGenerationsCount(null);
        setGenerationsLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFamilyTreeId]);

  // Family size stats (v290 fase iii b): agregat ukuran keluarga di
  // server v288, pola persis generations. Adapter null (mock, supabase),
  // treeId kosong, fetch berjalan, atau fetch gagal berarti section
  // tidak dirender.
  useEffect(() => {
    const api = currentFamilyTreeId ? getStatsApi() : null;
    if (!currentFamilyTreeId || !api) return;
    let cancelled = false;
    setFamilySizeLoaded(false);
    api
      .getFamilySizeStats(currentFamilyTreeId)
      .then((dto) => {
        if (cancelled) return;
        setFamilySizeStats(dto);
        setFamilySizeLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFamilySizeStats(null);
        setFamilySizeLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFamilyTreeId]);

  // Oldest living (v303 fase iii): peringkat anggota hidup tertua dari
  // server v302, pola persis family-size v290. Adapter null (mock,
  // supabase), treeId kosong, fetch berjalan, atau fetch gagal berarti
  // section tidak dirender.
  useEffect(() => {
    const api = currentFamilyTreeId ? getStatsApi() : null;
    if (!currentFamilyTreeId || !api) return;
    let cancelled = false;
    setOldestLivingLoaded(false);
    api
      .getOldestLiving(currentFamilyTreeId)
      .then((dto) => {
        if (cancelled) return;
        setOldestLiving(dto);
        setOldestLivingLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setOldestLiving(null);
        setOldestLivingLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFamilyTreeId]);

  return (
    <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Family Statistics</h2>
      
      {/* Overview Stats */}
      <div className="space-y-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalMembers}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center space-x-3">
            <TreePine className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Generations</p>
              <p className="text-3xl font-bold text-green-600">{stats.totalGenerations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gender Distribution */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">♂</div>
            <div className="text-2xl font-bold text-blue-600">{stats.maleCount}</div>
            <div className="text-sm text-gray-600">Male</div>
          </div>
          <div className="bg-pink-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-pink-600 mb-1">♀</div>
            <div className="text-2xl font-bold text-pink-600">{stats.femaleCount}</div>
            <div className="text-sm text-gray-600">Female</div>
          </div>
        </div>
      </div>

      {/* Living Stats */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Living Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{livingStats.living}</div>
            <div className="text-sm text-gray-600">Living</div>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-600">{livingStats.deceased}</div>
            <div className="text-sm text-gray-600">Deceased</div>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Avg Lifespan</span>
            <span className="font-semibold">
              {livingStats.avgLifespanYears === null
                ? 'N/A'
                : `${livingStats.avgLifespanYears} years`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Unknown Birth Date</span>
            <span className="font-semibold">{livingStats.unknownBirthDate}</span>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {AGE_BUCKETS.map((bucket) => (
            <div key={bucket} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{bucket} years</span>
              <span className="font-semibold">{livingStats.ageBuckets[bucket]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Age Groups PBB (v270 fase ii) */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.ageGroups.title')}</h3>
        <div className="space-y-2">
          {AGE_GROUPS_PBB.map((group) => (
            <div key={group} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t(`stats.ageGroups.${group.split('-')[0]}`)}</span>
              <span className="font-semibold">{ageGroups[group]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Birthdays (v276 fase ii) */}
      {upcomingBirthdays.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.upcomingBirthdays.title')}</h3>
          <div className="space-y-2">
            {upcomingBirthdays.map((entry) => (
              <div key={entry.personId} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{entry.displayName}</span>
                  {' · '}
                  {t('stats.upcomingBirthdays.turningAge', { count: entry.turningAge, ordinal: true })}
                  {' · '}
                  <time dateTime={entry.nextBirthday}>{formatYmdLocale(entry.nextBirthday, i18n.language)}</time>
                </span>
                <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  {entry.daysUntil === 0
                    ? t('stats.upcomingBirthdays.today')
                    : entry.daysUntil === 1
                      ? t('stats.upcomingBirthdays.tomorrow')
                      : t('stats.upcomingBirthdays.inDays', { count: entry.daysUntil })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Anniversaries (v277 fase ii, sumber endpoint server v275) */}
      {anniversariesLoaded && anniversaryEntries.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.upcomingAnniversaries.title')}</h3>
          <div className="space-y-2">
            {anniversaryEntries.map((entry) => (
              <div key={entry.pairId} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">{entry.partnerNames.join(' · ')}</span>
                  {' · '}
                  {t('stats.upcomingAnniversaries.anniversaryYear', { count: entry.yearsMarried, ordinal: true })}
                  {' · '}
                  <time dateTime={entry.nextAnniversary}>{formatYmdLocale(entry.nextAnniversary, i18n.language)}</time>
                </span>
                <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  {entry.daysUntil === 0
                    ? t('stats.upcomingAnniversaries.today')
                    : entry.daysUntil === 1
                      ? t('stats.upcomingAnniversaries.tomorrow')
                      : t('stats.upcomingAnniversaries.inDays', { count: entry.daysUntil })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generations (v286, sumber endpoint server via adapter) */}
      {generationsLoaded && generationsCount !== null && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.generations.title')}</h3>
          <div className="text-sm text-gray-600">{t('stats.generations.count', { count: generationsCount })}</div>
        </div>
      )}

      {/* Family Size (v290 fase iii b, sumber endpoint server via adapter) */}
      {familySizeLoaded && familySizeStats && familySizeStats.average !== null && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.familySize.title')}</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.average')}</span>
              <span className="font-semibold">{familySizeStats.average.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.median')}</span>
              <span className="font-semibold">{familySizeStats.median !== null ? familySizeStats.median.toFixed(1) : 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.terbesar')}</span>
              <span className="font-semibold">{familySizeStats.max}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.jumlah')}</span>
              <span className="font-semibold">{familySizeStats.familyCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.bucket.zero')}</span>
              <span className="font-semibold">{familySizeStats.distribution.zero}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.bucket.oneToTwo')}</span>
              <span className="font-semibold">{familySizeStats.distribution.oneToTwo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.bucket.threeToFour')}</span>
              <span className="font-semibold">{familySizeStats.distribution.threeToFour}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('stats.familySize.bucket.fivePlus')}</span>
              <span className="font-semibold">{familySizeStats.distribution.fivePlus}</span>
            </div>
          </div>
        </div>
      )}

      {/* Oldest Living (v303 fase iii, sumber endpoint server via adapter) */}
      {oldestLivingLoaded && oldestLiving && oldestLiving.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.oldestLiving.title')}</h3>
          <div className="mt-3 space-y-2">
            {oldestLiving.slice(0, 10).map((entry, index) => (
              <div key={entry.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{t('stats.oldestLiving.rank', { rank: index + 1 })}</span>
                <span className="font-semibold">{entry.ageYears}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Age Distribution */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution</h3>
        <div className="space-y-3">
          {Object.entries(stats.ageDistribution).map(([range, count]) => (
            <div key={range} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{range} years</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Location Distribution */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Locations</h3>
        <div className="space-y-3">
          {Object.entries(stats.locationDistribution).map(([location, count]) => (
            <div key={location} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{location}</span>
              </div>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};