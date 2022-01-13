import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { get } from 'lodash';
import dissolve from '@turf/dissolve';
import union from '@turf/union';
import { GeoJSONLayer } from 'react-mapbox-gl';
import MapboxGL from 'mapbox-gl';
// import { Feature, MultiPolygon, Polygon, Properties } from '@turf/helpers';
import turf from '@turf/turf';
import { showPopup } from '../../../../context/tooltipStateSlice';
import { BoundaryLayerProps } from '../../../../config/types';
import { LayerData } from '../../../../context/layers/layer-data';
import { layerDataSelector } from '../../../../context/mapStateSlice/selectors';
import { toggleSelectedBoundary } from '../../../../context/mapSelectionLayerStateSlice';
import { GeoJsonBoundary } from '../raster-utils';

function onToggleHover(cursor: string, targetMap: MapboxGL.Map) {
  // eslint-disable-next-line no-param-reassign, fp/no-mutation
  targetMap.getCanvas().style.cursor = cursor;
}

function BoundaryLayer({ layer }: { layer: BoundaryLayerProps }) {
  const dispatch = useDispatch();
  const boundaryLayer = useSelector(layerDataSelector(layer.id)) as
    | LayerData<BoundaryLayerProps>
    | undefined;
  const { data } = boundaryLayer || {};

  if (!data) {
    return null; // boundary layer hasn't loaded yet. We load it on init inside MapView. We can't load it here since its a dependency of other layers.
  }

  const onClickFunc = (evt: any) => {
    const coordinates = evt.lngLat;
    const locationName = layer.adminLevelNames
      .map(level => get(evt.features[0], ['properties', level], '') as string)
      .join(', ');
    dispatch(showPopup({ coordinates, locationName }));
    // send the selection to the map selection layer. No-op if selection mode isn't on.
    dispatch(
      toggleSelectedBoundary(evt.features[0].properties[layer.adminCode]),
    );
  };

  // const layerByAdminLevels = layer.adminLevelNames.map(adminLevelName =>
  //   dissolve(data, { propertyName: adminLevelName }),
  // );

  // Group features and merge them by admin level. Here "ST" for testing.
  const firstLevelData = data.features.reduce(
    (acc: Record<string, GeoJsonBoundary>, f) => {
      const feature = f as GeoJsonBoundary;
      const levelKey: string = get(feature, ['properties', 'ST'], 'no_level');
      const existingData = get(acc, [levelKey]);
      // console.log({ levelKey, existingData });
      try {
        const newAcc = existingData
          ? {
              ...acc,
              [levelKey]: union(existingData, feature) as GeoJsonBoundary,
            }
          : {
              ...acc,
              [levelKey]: feature,
            };
        return newAcc;
      } catch {
        return acc;
      }
    },
    {} as Record<string, GeoJsonBoundary>,
  );

  const newData = {
    ...data,
    features: Object.values(firstLevelData),
  };

  console.log(firstLevelData);

  // const firstLevelDataLists = data.features.reduce(
  //   (acc: Record<string, GeoJsonBoundary[]>, f) => {
  //     const feature = f as GeoJsonBoundary;
  //     const levelKey: string = get(feature, ['properties', 'ST'], 'no_level');
  //     const existingData = get(acc, [levelKey]);
  //     console.log({ levelKey, existingData });
  //     const newAcc = existingData
  //       ? {
  //           ...acc,
  //           [levelKey]: acc[levelKey].concat(feature),
  //         }
  //       : {
  //           ...acc,
  //           [levelKey]: [feature],
  //         };
  //     return newAcc;
  //   },
  //   {} as Record<string, GeoJsonBoundary[]>,
  // );

  // console.log(firstLevelDataLists);

  // const finalData = Object.keys(firstLevelDataLists).map(key => {
  //   const groupValues = firstLevelDataLists[key]
  //   if (groupValues.length >= 2) {
  //   // eslint-disable-next-line prefer-spread
  //     return union.apply(null, groupValues)
  //   }
  //   return null
  //   }
  // );

  // const firstLevelData = data.features.reduce((acc, feature) => {
  //   const levelKey = get(feature, ['properties', 'ST'], 'no_level');
  //   const existingData = get(acc, [levelKey]);
  //   return {
  //     ...acc,
  //     [levelKey]: existingData
  //       ? union(
  //           existingData,
  //           feature as Feature<Polygon | MultiPolygon, Properties>,
  //         )
  //       : feature,
  //   };
  // }, {});

  // console.log(layerByAdminLevels)

  // const layers = Object.keys(rawLayers).reduce(
  //   (acc, layerKey) => ({
  //     ...acc,
  //     [layerKey]: getLayerByKey(layerKey as LayerKey),
  //   }),
  //   {} as LayersMap,
  // );

  // Construct adminLayer line-width case expression.
  const lineWidthCaseExpression: any[] = ['case'];
  // TODO - Use reduceRight
  layer.adminLevelNames
    .slice()
    .reverse()
    .forEach((levelName, index) => {
      lineWidthCaseExpression.push(['has', levelName], 0.5 + 0.5 * index);
    });
  // Push default
  lineWidthCaseExpression.push(0.5);

  console.log(lineWidthCaseExpression);

  return (
    <GeoJSONLayer
      id={layer.id === 'admin_boundaries' ? 'boundaries' : layer.id}
      data={newData}
      // layerOptions={{ filter: ['has', 'TS_PCODE'] }}
      fillPaint={layer.styles.fill}
      linePaint={{
        'line-color': 'gray',
        'line-width': lineWidthCaseExpression,
        'line-opacity': 0.8,
      }}
      fillOnMouseEnter={(evt: any) => onToggleHover('pointer', evt.target)}
      fillOnMouseLeave={(evt: any) => onToggleHover('', evt.target)}
      fillOnClick={layer.id === 'admin_boundaries' ? onClickFunc : undefined}
    />
  );
}

export default BoundaryLayer;
