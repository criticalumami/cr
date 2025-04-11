const fs = require('fs');
const turf = require('@turf/turf');

// Read the GeoJSON files
const crData = JSON.parse(fs.readFileSync('./data/CR.geojson', 'utf8'));
const buildingsData = JSON.parse(fs.readFileSync('./data/buildings.geojson', 'utf8'));

// Get the CR boundary polygon
const crBoundary = crData.features[0];

// Filter buildings that intersect with the CR boundary
const filteredBuildings = buildingsData.features.filter(building => {
    return turf.booleanIntersects(building, crBoundary);
});

// Create new GeoJSON with filtered buildings
const filteredGeoJSON = {
    type: 'FeatureCollection',
    features: filteredBuildings
};

// Backup original buildings file
fs.copyFileSync('./data/buildings.geojson', './data/buildings.backup.geojson');

// Write the filtered GeoJSON back to the buildings file
fs.writeFileSync('./data/buildings.geojson', JSON.stringify(filteredGeoJSON, null, 2));