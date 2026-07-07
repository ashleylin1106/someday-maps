// Write the CSV to a temp file and open the system share sheet (save, email, cloud, etc.)

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Place } from './types';
import { placesToCsv, csvFileName } from './csv';

export async function exportPlacesCsv(places: Place[]): Promise<void> {
  const csv = placesToCsv(places);
  const file = new File(Paths.cache, csvFileName());

  // Overwrite any old file
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export places CSV (for Google My Maps)',
    UTI: 'public.comma-separated-values-text',
  });
}
