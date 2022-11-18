import type { Feature, MultiPolygon, BBox, Polygon } from '@turf/helpers';
import bbox from '@turf/bbox';
import { multiPolygon } from '@turf/helpers';
import bboxPolygon from '@turf/bbox-polygon';
import union from '@turf/union';
import { BoundaryLayerData } from '../../../context/layers/boundary';

export type BoundaryRelationData = {
  levels: number[];
  relations: BoundaryRelation[];
};

type FeatureRelation = {
  value: string;
  parent: string;
  child: string;
  bboxLowest: BBox; // Lowest Level bounding box.
  level: number;
};

export type BoundaryRelation = {
  name: string;
  parent: string;
  level: number;
  children: string[];
  bbox: BBox;
};

const getFeatureRelations = (
  adminLevelNames: string[],
  feature: Feature,
): FeatureRelation[] | undefined => {
  const { properties, geometry } = feature;

  if (!properties) {
    return undefined;
  }

  const relations = adminLevelNames.map((adminLevelName, index) => {
    return {
      level: index,
      value: properties[adminLevelName],
      parent: properties[adminLevelNames[index - 1]],
      child: properties[adminLevelNames[index + 1]],
    };
  });

  const featureBbox = bbox(
    multiPolygon((geometry as MultiPolygon).coordinates),
  );

  return relations.map(rel => ({ ...rel, bboxLowest: featureBbox }));
};

const makeBoundaryBbox = (bboxes: BBox[]): BBox => {
  const bboxPolygons = bboxes.map(box => bboxPolygon(box));

  const unionGeom = bboxPolygons.reduce((unionPolygon, polygon) => {
    const unionObj = union(unionPolygon, polygon);
    if (!unionObj) {
      return unionPolygon;
    }
    return unionObj as Feature<Polygon>;
  }, bboxPolygons[0]);

  return bbox(unionGeom);
};

const getFeatures = (
  relations: BoundaryRelation[],
  name: string,
  level: number,
): BoundaryRelation[] => {
  const relation = relations.find(i => i.level === level && i.name === name);

  if (!relation) {
    return [];
  }

  const relChildren: BoundaryRelation[] = relation.children
    .map(childName => getFeatures(relations, childName, relation.level + 1))
    .reduce((acc, child) => [...acc, ...child], []);

  return [relation, ...relChildren];
};

export const getParentRelation = (
  relations: BoundaryRelation[],
  parentName: string,
  level: number,
): BoundaryRelation[] => {
  const relation = relations.find(
    i => i.level === level && i.name === parentName,
  );

  if (!relation) {
    return [];
  }

  if (!relation.parent) {
    return [relation];
  }

  return [
    ...getParentRelation(relations, relation.parent, relation.level - 1),
    relation,
  ];
};

type PropertyName = {
  adminLevelNameProperty: string;
  adminLevelNamePropertyChild: string;
  adminLevelNamePropertyParent: string;
};

type AdminLevelObject = {
  level: number;
  names: AdminLevelName[];
};

type AdminLevelProperty = {
  key: string;
  value: string;
};

type AdminLevelName = {
  name: AdminLevelProperty;
  parent: AdminLevelProperty;
  child: AdminLevelProperty;
};

const getAdminLevelValueSet = (
  features: Feature<MultiPolygon>[],
  propertyName: PropertyName,
): AdminLevelName[] => {
  const {
    adminLevelNameProperty,
    adminLevelNamePropertyParent,
    adminLevelNamePropertyChild,
  } = propertyName;

  // Get all possible values for the given adminLevelNameProperty.
  const values: AdminLevelName[] = features.map(feature => ({
    name: {
      key: adminLevelNameProperty,
      value: feature.properties![adminLevelNameProperty],
    },
    parent: {
      key: adminLevelNamePropertyParent,
      value: feature.properties![adminLevelNamePropertyParent],
    },
    child: {
      key: adminLevelNamePropertyChild,
      value: feature.properties![adminLevelNamePropertyChild],
    },
  }));

  const valueSet: AdminLevelName[] = values.reduce((set, item) => {
    if (
      set.find(
        itemSet =>
          item.name.value === itemSet.name.value &&
          item.parent.value === itemSet.parent.value,
      )
    ) {
      return set;
    }

    return [...set, item];
  }, [] as AdminLevelName[]);

  return valueSet;
};

const createRelationObj = (
  features: Feature<MultiPolygon>[],
  adminLevelName: AdminLevelName,
  level: number,
): BoundaryRelation => {
  const { name, parent, child } = adminLevelName;

  const matches = features
    .filter(
      feature =>
        feature.properties![name.key] === name.value &&
        feature.properties![parent.key] === parent.value,
    )
    .map(feature => feature as Feature<MultiPolygon>);

  // Create Bbox
  const unionGeom = matches.reduce((unionGeometry, match) => {
    const unionObj = union(unionGeometry, match);
    if (!unionObj) {
      return unionGeometry;
    }
    return unionObj as Feature<MultiPolygon>;
  }, matches[0]);

  const bboxUnion: BBox = bbox(unionGeom);

  // Get childrens.
  const children: string[] = matches
    .map(feature => feature.properties![child.key])
    .reduce((childrenSet, featureName) => {
      if (featureName === undefined || childrenSet.includes(featureName)) {
        return childrenSet;
      }

      return [...childrenSet, featureName];
    }, []);

  const parentNames: string[] = [
    ...new Set(matches.map(match => match.properties![parent.key])),
  ];

  // Parent names should be the same.
  return {
    name: name.value,
    parent: parentNames[0],
    level,
    children,
    bbox: bboxUnion,
  };
};

const buildRelationTree = (
  boundaryLayerData: BoundaryLayerData,
  adminLevelNames: string[],
): any => {
  const { features } = boundaryLayerData;
  const featuresMulti = features as Feature<MultiPolygon>[];

  const propertyNames: PropertyName[] = adminLevelNames.map((_, index) => ({
    adminLevelNameProperty: adminLevelNames[index],
    adminLevelNamePropertyChild: adminLevelNames[index + 1],
    adminLevelNamePropertyParent: adminLevelNames[index - 1],
  }));

  const adminLevelObjects: AdminLevelObject[] = propertyNames.map(
    (propertyName, index) => ({
      level: index,
      names: getAdminLevelValueSet(featuresMulti, propertyName),
    }),
  );

  const adminLevelValue = adminLevelObjects[0];
  const { level, names } = adminLevelValue;
  const relations = names.map(adminLevelName =>
    createRelationObj(featuresMulti, adminLevelName, level),
  );
  console.log(relations);

  return propertyNames;
};

export const loadBoundaryRelations = (
  boundaryLayerData: BoundaryLayerData,
  adminLevelNames: string[],
): BoundaryRelationData => {
  const boom = buildRelationTree(boundaryLayerData, adminLevelNames);

  const featureRelations = boundaryLayerData.features.reduce((acc, feature) => {
    const relations = getFeatureRelations(adminLevelNames, feature as Feature);

    if (!relations) {
      return acc;
    }

    return [...acc, ...relations];
  }, [] as FeatureRelation[]);

  const adminLevelNumbers: number[] = adminLevelNames.map((_, index) => index);

  const relations = featureRelations.reduce((relationsAcc, relation) => {
    const { parent: searchParent, value: searchValue, level } = relation;

    // Discard value if exists already in the accumulator.
    const accMatches = relationsAcc.filter(
      relItem =>
        relItem.name === searchValue && relItem.parent === searchParent,
    );
    if (accMatches.length === 1) {
      return relationsAcc;
    }

    const matches = featureRelations.filter(
      fr => fr.parent === searchParent && fr.value === searchValue,
    );

    const children = matches
      .filter(match => match.child !== undefined)
      .map(match => match.child as string);

    const childrenSet = [...new Set(children)];

    const boundaryBbox = makeBoundaryBbox(matches.map(c => c.bboxLowest));

    const boundaryRelation = {
      name: searchValue,
      parent: searchParent,
      level,
      children: childrenSet,
      bbox: boundaryBbox,
    };

    return [...relationsAcc, boundaryRelation];
  }, [] as BoundaryRelation[]);

  const results = relations
    .filter(rel => rel.level === adminLevelNumbers[0])
    .reduce(
      (acc, rel) => [
        ...acc,
        ...getFeatures(relations, rel.name, adminLevelNumbers[0]),
      ],
      [] as BoundaryRelation[],
    );

  return { levels: adminLevelNumbers, relations: results };
};

export const setMenuItemStyle = (
  level: number,
  levels: number[],
  styles: { [key: string]: string },
): string => {
  switch (level) {
    case levels[0]:
      return styles.header;
    case levels[levels.length - 1]:
      return styles.menuItem;
    default:
      return styles.subHeader;
  }
};

export const containsText = (text: string, searchText: string) =>
  text.toLowerCase().indexOf(searchText.toLowerCase()) > -1;

export const createMatchesTree = (
  relations: BoundaryRelation[],
  relationsFilter: BoundaryRelation[],
): BoundaryRelation[] =>
  relationsFilter
    .reduce((acc, match) => {
      if (!match.parent) {
        return [...acc, match];
      }

      // Check if element has been already included.
      if (
        acc.find(rel => rel.name === match.name && rel.level === match.level)
      ) {
        return acc;
      }

      // Get all relations that have same parent and level.
      const matchParent = relationsFilter.filter(
        rel => rel.parent === match.parent && rel.level === match.level,
      );

      const getmatchedParents = getParentRelation(
        relations,
        match.parent,
        match.level - 1,
      );

      const mergedRelations = [...getmatchedParents, ...matchParent];

      return [...acc, ...mergedRelations];
    }, [] as BoundaryRelation[])
    // Discard repeated from parent matches.
    .reduce((acc, item) => {
      if (
        acc.find(elem => elem.name === item.name && elem.level === item.level)
      ) {
        return acc;
      }

      return [...acc, item];
    }, [] as BoundaryRelation[]);
