import * as cheerio from 'cheerio';
import { convert as geoConvert } from 'geo-coordinates-parser';
import type { RawStation } from '../models/types.js';

export function parseStationsHtml(html: string): RawStation[] {
  const $ = cheerio.load(html);
  const stations: RawStation[] = [];
  let firstError: string | undefined;

  $('#petroleumPriceDetailsFootable tbody tr').each(function () {
    try {
      const brand = $(this).find('td:nth-child(1)').text().trim();
      const name = $(this).find('td:nth-child(2)').text().trim();

      const addressLink = $(this).find('td:nth-child(3) a');
      const address = addressLink
        .text()
        .split('\n')
        .map((i: string) => i.trim())
        .filter(Boolean)
        .join(', ');

      const href = addressLink.attr('href') ?? '';
      const rawCoords = href.split('coordinates=')[1]?.trim() ?? '';
      const coordsStr = rawCoords ? decodeURIComponent(rawCoords).replace(',', ', ') : '';

      if (!coordsStr) return; // skip if no coordinates

      const coords = geoConvert(coordsStr, 8);

      const area = $(this).find('td:nth-child(4)').text().trim();
      const priceText = $(this).find('td:nth-child(5)').text().trim().replace(',', '.');
      const price = parseFloat(priceText);

      if (isNaN(price)) return; // skip invalid prices

      stations.push({
        brand,
        name,
        location: {
          address,
          area,
          coordinates: {
            latitude: coords.decimalLatitude,
            longitude: coords.decimalLongitude,
          },
        },
        price,
      });
    } catch (err) {
      // Log only the first failure per scrape to surface DOM regressions
      // without flooding logs if the whole table breaks.
      if (!firstError) {
        firstError = (err as Error).message;
        console.warn('[parser] skipped malformed row:', firstError);
      }
    }
  });

  return stations;
}
