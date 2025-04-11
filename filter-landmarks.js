const fs = require('fs');
const turf = require('@turf/turf');

// Define file paths
const crFilePath = './data/CR.geojson';
const landmarksFilePath = './data/leaf_landmarks.geojson';
const landmarksBackupFilePath = './data/leaf_landmarks.backup.geojson';

// Read the GeoJSON files
let crData, landmarksData;
try {
    crData = JSON.parse(fs.readFileSync(crFilePath, 'utf8'));
    landmarksData = JSON.parse(fs.readFileSync(landmarksFilePath, 'utf8'));
} catch (err) {
    console.error("Error reading GeoJSON files:", err);
    process.exit(1);
}

// Ensure CR data has features and geometry
if (!crData.features || crData.features.length === 0 || !crData.features[0].geometry) {
    console.error("CR.geojson is missing features or geometry.");
    process.exit(1);
}
const crBoundary = crData.features[0]; // Assuming the first feature is the boundary polygon

// Ensure landmarks data has features
if (!landmarksData.features) {
    console.error("leaf_landmarks.geojson is missing features.");
    process.exit(1);
}

// Filter landmarks that are inside the CR boundary
const filteredLandmarks = landmarksData.features.filter(landmark => {
    if (!landmark.geometry || landmark.geometry.type !== 'Point') {
        console.warn('Skipping landmark without Point geometry:', landmark.properties);
        return false;
    }
    try {
        return turf.booleanPointInPolygon(landmark.geometry, crBoundary);
    } catch (err) {
        console.error("Error during spatial check for landmark:", landmark.properties, err);
        return false;
    }
});

// Create new GeoJSON with filtered landmarks
const filteredGeoJSON = {
    type: 'FeatureCollection',
    features: filteredLandmarks
};

// Backup original landmarks file
try {
    fs.copyFileSync(landmarksFilePath, landmarksBackupFilePath);
    console.log(`Backed up original landmarks to ${landmarksBackupFilePath}`);
} catch (err) {
    console.error("Error backing up landmarks file:", err);
    process.exit(1);
}

// Write the filtered GeoJSON back to the landmarks file
try {
    fs.writeFileSync(landmarksFilePath, JSON.stringify(filteredGeoJSON, null, 2));
    console.log(`Successfully filtered landmarks. ${filteredLandmarks.length} landmarks remain.`);
} catch (err) {
    console.error("Error writing filtered landmarks file:", err);
    process.exit(1);
}