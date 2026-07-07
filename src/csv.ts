// Generate a CSV compatible with Google My Maps import

import { Place, TYPE_LABELS, STATUS_LABELS } from './types';
import { mapsUrl } from './maps';

// Escape one field: always wrap in double quotes, double any inner quotes
function esc(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

// My Maps needs a position column. Prefer the address; when there's no address,
// use "name city country" as a geocodable search string so the marker still lands.
function positionAddress(p: Place): string {
  const addr = p.address.trim();
  if (addr) return addr;
  return [p.name, p.city, p.country].filter(Boolean).join(' ').trim();
}

const HEADERS = [
  'Name',
  'Address',
  'Latitude',
  'Longitude',
  'Country',
  'City',
  'Type',
  'Status',
  'Rating',
  'Note',
  'Source',
  'Google Maps',
];

export function placesToCsv(places: Place[]): string {
  const rows: string[] = [];
  rows.push(HEADERS.map(esc).join(','));

  for (const p of places) {
    rows.push(
      [
        p.name,
        positionAddress(p),
        p.lat == null ? '' : String(p.lat),
        p.lng == null ? '' : String(p.lng),
        p.country,
        p.city,
        TYPE_LABELS[p.type],
        STATUS_LABELS[p.status],
        p.rating == null ? '' : String(p.rating),
        p.note,
        p.sourceUrl,
        mapsUrl(p),
      ]
        .map((v) => esc(String(v)))
        .join(',')
    );
  }

  // Prepend a BOM so Excel / My Maps read UTF-8 (non-Latin text) correctly
  return '﻿' + rows.join('\r\n');
}

// Build a dated filename
export function csvFileName(prefix = 'bucketlist'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
}
