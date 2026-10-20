import { describe, expect, it } from 'vitest';
import { changedFiles, classifySiteFiles } from '../siteFiles';

describe('siteFiles', () => {
  it('classifies files by extension, case-insensitively', () => {
    expect(classifySiteFiles(['a.INP', 'layout.geojson', 'dem.asc', 'notes.txt'])).toEqual({ inp: 'a.INP', geojson: 'layout.geojson', asc: 'dem.asc', unknown: ['notes.txt'], duplicates: [] });
    expect(classifySiteFiles(['layout.json']).geojson).toBe('layout.json');
    expect(classifySiteFiles(['a.inp', 'b.inp']).duplicates).toEqual(['b.inp']);
  });
  it('reports files whose lastModified changed', () => {
    expect(changedFiles({ 'a.inp': 1, 'b.asc': 5 }, { 'a.inp': 2, 'b.asc': 5 })).toEqual(['a.inp']);
    expect(changedFiles({ 'a.inp': 1 }, { 'a.inp': 1 })).toEqual([]);
  });
});
