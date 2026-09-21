import { describe, expect, it } from 'vitest'
import {
  filterResnForExport,
  resolveExportResn,
} from './resn-export-filter'

describe('filterResnForExport', () => {
  it('membuang CONFIDENTIAL tunggal', () => {
    expect(filterResnForExport(['CONFIDENTIAL'])).toEqual([])
  })

  it('membuang hanya CONFIDENTIAL di antara multi-nilai', () => {
    expect(filterResnForExport(['PRIVACY', 'CONFIDENTIAL', 'LOCKED'])).toEqual([
      'PRIVACY',
      'LOCKED',
    ])
  })

  it('PRIVACY lolos fase ekspor', () => {
    expect(filterResnForExport(['PRIVACY'])).toEqual(['PRIVACY'])
  })

  it('LOCKED lolos fase ekspor', () => {
    expect(filterResnForExport(['LOCKED'])).toEqual(['LOCKED'])
  })

  it('null menghasilkan array kosong', () => {
    expect(filterResnForExport(null)).toEqual([])
  })

  it('undefined menghasilkan array kosong', () => {
    expect(filterResnForExport(undefined)).toEqual([])
  })

  it('empty string dibuang setelah normalisasi', () => {
    expect(filterResnForExport([''])).toEqual([])
  })

  it('nilai multi-token koma terurai dan difilter', () => {
    expect(filterResnForExport(['CONFIDENTIAL, LOCKED'])).toEqual(['LOCKED'])
  })

  it('dedup mempertahankan urutan kemunculan pertama', () => {
    expect(filterResnForExport(['PRIVACY', 'LOCKED', 'PRIVACY'])).toEqual([
      'PRIVACY',
      'LOCKED',
    ])
  })

  it('idempoten: filter dua kali sama dengan filter sekali', () => {
    const input = ['CONFIDENTIAL', 'PRIVACY, LOCKED', 'PRIVACY']
    const once = filterResnForExport(input)
    expect(filterResnForExport(once)).toEqual(once)
  })
})

describe('resolveExportResn', () => {
  it('RESN event mengungguli RESN record', () => {
    expect(
      resolveExportResn({ resn: 'PRIVACY', resnMulti: ['CONFIDENTIAL'] }),
    ).toEqual(['PRIVACY'])
    expect(
      resolveExportResn({ resn: 'CONFIDENTIAL', resnMulti: ['LOCKED'] }),
    ).toEqual([])
  })

  it('input null menghasilkan array kosong', () => {
    expect(resolveExportResn(null)).toEqual([])
  })

  it('hanya RESN record CONFIDENTIAL menghasilkan array kosong', () => {
    expect(
      resolveExportResn({ resn: null, resnMulti: ['CONFIDENTIAL'] }),
    ).toEqual([])
  })

  it('mix event PRIVACY dan record CONFIDENTIAL memakai event', () => {
    expect(
      resolveExportResn({ resn: 'PRIVACY', resnMulti: ['CONFIDENTIAL', 'LOCKED'] }),
    ).toEqual(['PRIVACY'])
  })
})
