import { sortBy } from 'lodash';
import GeoJSON from 'geojson';
import moment from 'moment';
import { ACLED_ISO } from '../config';
import { PointLayerData } from '../config/types';

export const fetchACLEDDates = async (url: string): Promise<number[]> => {
  if (!ACLED_ISO) {
    throw new Error(
      'ACLED processing is defined in layers.json but environment variables were not found',
    );
  }

  const datesUrl = `${url}?iso=${ACLED_ISO}&limit=0&fields=event_date`;

  const resp = await fetch(datesUrl);
  const respJson = await resp.json();

  /* eslint-disable camelcase */
  const dates: number[] = respJson.data.map((item: { event_date: string }) =>
    moment(item.event_date).valueOf(),
  );
  /* eslint-enable camelcase */

  const datesSet = [...new Set(dates)];

  return sortBy(datesSet);
};

export const fetchACLEDLocations = async (
  url: string,
  date: number,
): Promise<PointLayerData> => {
  const dateStr = moment(date).format('YYYY-MM-DD');

  const incidentsUrl = `${url}?&iso=${ACLED_ISO}&limit=0&event_date=${dateStr}`;

  const resp = await fetch(incidentsUrl);
  const respJson = await resp.json();

  /* eslint-disable camelcase */
  const incidents = respJson.data.map((incident: any) => ({
    ...incident,
    lat: parseFloat(incident.latitude),
    lon: parseFloat(incident.longitude),
    fatalities: parseInt(incident.fatalities, 10),
  }));

  return {
    features: GeoJSON.parse(incidents, {
      Point: ['lat', 'lon'],
    }),
  };
};
