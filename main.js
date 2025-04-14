// Global variables
let map;
let layerControl;
const layers = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupControls();
    loadData();
});

// Map style constants
const STYLES = {
    mask: {
        color: 'white',
        fillColor: 'white',
        fillOpacity: 0.7,
        stroke: false,
        interactive: false
    },
    boundary: {
        color: 'black',
        weight: 2,
        fill: false,
        fillOpacity: 0
    },
    buildings: {
        className: 'buildings-layer'
    },
    surveyLines: {
        color: '#cccccc',
        weight: 1
    },
    parks: {
        color: 'darkgreen',
        fillColor: 'lightgreen',
        fillOpacity: 0.5,
        weight: 1
    },
    detailedZones: {
        color: '#FFA500',
        fillColor: '#FFE4B5',
        fillOpacity: 0.6,
        weight: 2
    }
};

// Icon definitions
const ICONS = {
    landmark: L.icon({
        iconUrl: 'icons/loz.svg',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    }),
    photo: L.icon({
        iconUrl: 'icons/photo.svg',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    })
};

// Initialize map and base layers
function initMap() {
    map = L.map('map', { 
        attributionControl: false,
        zoomControl: true
    });

    // Define basemaps
    const baseMaps = {
        "Minimalist": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19
        }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19
        }),
        "White": L.tileLayer('', {
            maxZoom: 19
        })
    };
    
    // Add default basemap
    baseMaps["Minimalist"].addTo(map);
    
    // Create layer control
    layerControl = L.control.layers(baseMaps, {}, { position: 'bottomright' }).addTo(map);

    // Add the fullscreen button
    const fullscreenButton = L.control({ position: 'topright' });
    fullscreenButton.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-control-fullscreen');
        div.innerHTML = '🔲';  // You can replace this with an icon or custom text

        div.style.cursor = 'pointer';

        // Add click event to toggle fullscreen mode
        div.addEventListener('click', () => toggleFullscreen(map));

        return div;
    };
    fullscreenButton.addTo(map);
}

// Function to toggle fullscreen mode
function toggleFullscreen() {
    if (!document.fullscreenElement &&     // Check if not in fullscreen
        !document.mozFullScreenElement &&  // Firefox
        !document.webkitFullscreenElement && // Chrome, Safari, Opera
        !document.msFullscreenElement) {  // IE/Edge
        // If not in fullscreen, request fullscreen
        const mapContainer = document.getElementById('map'); // Your map container ID
        if (mapContainer.requestFullscreen) {
            mapContainer.requestFullscreen();
        } else if (mapContainer.mozRequestFullScreen) { // Firefox
            mapContainer.mozRequestFullScreen();
        } else if (mapContainer.webkitRequestFullscreen) { // Chrome, Safari, Opera
            mapContainer.webkitRequestFullscreen();
        } else if (mapContainer.msRequestFullscreen) { // IE/Edge
            mapContainer.msRequestFullscreen();
        }
    } else {
        // If already in fullscreen, exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { // Chrome, Safari, Opera
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            document.msExitFullscreen();
        }
    }
}

// Set up map controls (title, scale, north arrow)
function setupControls() {
    // Add map title
    const mapTitle = L.control({position: 'topright'});
    mapTitle.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-title');
        div.innerHTML = 'Cola Roundabout - S07';
        return div;
    };
    mapTitle.addTo(map);

    // Add scale bar
    L.control.scale({
        maxWidth: 200,
        metric: true,
        imperial: false,
        position: 'bottomleft'
    }).addTo(map);

    // Add north arrow
    const northArrow = L.control({ position: 'bottomright' });
    northArrow.onAdd = function() {
        const div = L.DomUtil.create('div', 'north-arrow');
        div.innerHTML = '<img src="icons/north-arrow.svg" alt="North Arrow">';
        return div;
    };
    northArrow.addTo(map);
}

// Load all data layers
function loadData() {
    showLoading();
    
    loadBoundary()
        .then(() => {
            // Load other layers in parallel after boundary is loaded
            return Promise.all([
                loadLayer('buildings', 'data/buildings.geojson', STYLES.buildings, true),
                loadLandmarks(),
                loadLayer('surveyLines', 'data/surv.geojson', { style: STYLES.surveyLines }, true),
                loadLayer('parks', 'data/parks_filtered.geojson', { style: STYLES.parks }, true),
                loadPhotos(),
                loadCRNodes(),
                loadDetailedZones()
            ]);
        })
        .catch(error => {
            console.error('Error loading map data:', error);
        })
        .finally(() => {
            hideLoading();
        });
}

// Load CR boundary and create mask
function loadBoundary() {
    return fetch('data/CR.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load CR boundary');
            return response.json();
        })
        .then(data => {
            const feature = data.features[0];
            
            if (feature.geometry.type === 'Polygon') {
                // Create mask and boundary
                createBoundaryMask(feature);
                
                // Add the boundary line separately
                const boundaryLayer = L.geoJSON(feature, {
                    style: STYLES.boundary
                }).addTo(map);
                
                // Store reference and fit map to boundary
                layers.boundary = boundaryLayer;
                map.fitBounds(boundaryLayer.getBounds());
                
                return boundaryLayer;
            }
            throw new Error('Invalid boundary geometry');
        });
}

// Create mask outside boundary
function createBoundaryMask(feature) {
    // Define coordinates for the world bounds
    const outerBounds = [
        [-90, -180],
        [-90, 180],
        [90, 180],
        [90, -180],
        [-90, -180]
    ];
    
    // Get the coordinates for the inner hole (CR boundary)
    const innerHole = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]); // Swap lon/lat for Leaflet
    
    // Combine outer bounds and inner hole for the mask polygon
    const maskCoords = [outerBounds, innerHole];
    
    // Create and add the mask layer
    const maskLayer = L.polygon(maskCoords, STYLES.mask).addTo(map);
    layers.mask = maskLayer;
    
    return maskLayer;
}

// Generic function to load GeoJSON layer
function loadLayer(id, url, options, addToMap = false) {
    return fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return response.json();
        })
        .then(data => {
            const layer = L.geoJSON(data, options);
            
            if (addToMap) {
                layer.addTo(map);
            }
            
            layers[id] = layer;
            layerControl.addOverlay(layer, toTitleCase(id));
            
            return layer;
        })
        .catch(error => {
            console.error(`Error loading ${id}:`, error);
            return null;
        });
}

// Load landmarks layer
function loadLandmarks() {
    return fetch('data/leaf_landmarks.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load landmarks');
            return response.json();
        })
        .then(data => {
            const landmarksLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    const marker = L.marker(latlng, { icon: ICONS.landmark });
                    marker.bindTooltip(feature.properties.Name, {
                        permanent: false,
                        direction: 'top',
                        offset: [0, -12],
                        className: 'landmark-tooltip'
                    });
                    return marker;
                }
            });
            
            landmarksLayer.addTo(map);
            layers.landmarks = landmarksLayer;
            layerControl.addOverlay(landmarksLayer, 'Landmarks');
            
            return landmarksLayer;
        })
        .catch(error => {
            console.error('Error loading landmarks:', error);
            return null;
        });
}

// Load photos layer
function loadPhotos() {
    return fetch('data/photos.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load photos');
            return response.json();
        })
        .then(data => {
            const photosLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    const marker = L.marker(latlng, { 
                        icon: ICONS.photo,
                        rotationAngle: feature.properties.direction || 0 
                    });
                    
                    const tooltipContent = `
                        <div>
                            <img src="photos/${feature.properties.filename}.JPG" class="photo-thumbnail" alt="${feature.properties.Name}"/>
                            <div>${feature.properties.filename}</div>
                        </div>
                    `;
                    
                    marker.bindTooltip(tooltipContent, {
                        permanent: false,
                        direction: 'top',
                        offset: [0, -12],
                        className: 'photo-tooltip'
                    });
                    return marker;
                }
            });
            
            photosLayer.addTo(map);
            layers.photos = photosLayer;
            layerControl.addOverlay(photosLayer, 'Photos');
            
            return photosLayer;
        })
        .catch(error => {
            console.error('Error loading photos:', error);
            return null;
        });
}

// Load CR nodes layer
function loadCRNodes() {
    return fetch('data/nodes.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load CR nodes');
            return response.json();
        })
        .then(data => {
            // Filter only nodes that start with CR
            const crNodes = {
                type: "FeatureCollection",
                features: data.features.filter(f => f.properties.Name && f.properties.Name.startsWith('CR'))
            };

            const crNodesLayer = L.geoJSON(crNodes, {
                pointToLayer: function(feature, latlng) {
                    const circleMarker = L.circleMarker(latlng, {
                        radius: 12,
                        fillColor: '#FFFFFF',
                        color: '#000000',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 1,
                        zIndexOffset: 1000
                    });

                    // Add permanent label
                    circleMarker.bindTooltip(feature.properties.Name, {
                        permanent: true,
                        direction: 'top',
                        offset: [0, -12],
                        className: 'cr-node-label',
                        zIndexOffset: 1000
                    });

                    return circleMarker;
                }
            });
            
            crNodesLayer.addTo(map);
            layers.crNodes = crNodesLayer;
            layerControl.addOverlay(crNodesLayer, 'CR Nodes');
            
            return crNodesLayer;
        })
        .catch(error => {
            console.error('Error loading CR nodes:', error);
            return null;
        });
}

// Load detailed zones layer
function loadDetailedZones() {
    return fetch('data/det.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load detail zones');
            return response.json();
        })
        .then(data => {
            const detLayer = L.geoJSON(data, {
                style: STYLES.detailedZones,
                onEachFeature: function(feature, layer) {
                    if (feature.properties.name) {
                        addZoneLabel(feature, layer);
                    }
                    
                    if (feature.properties.url) {
                        addZoneInteractivity(feature, layer);
                    }
                }
            });
            
            detLayer.addTo(map);
            layers.detailedZones = detLayer;
            layerControl.addOverlay(detLayer, 'Detail Zones');
            
            return detLayer;
        })
        .catch(error => {
            console.error('Error loading detail zones:', error);
            return null;
        });
}

// Add label for detailed zone
function addZoneLabel(feature, layer) {
    const bounds = layer.getBounds();
    const west = bounds.getWest();
    const width = bounds.getEast() - west;
    const labelPoint = L.latLng(bounds.getCenter().lat, west - width * 0.5);
    
    // Create a point marker for the label
    const labelMarker = L.marker(labelPoint, {
        icon: L.divIcon({
            className: 'det-zone-label',
            html: feature.properties.name,
            iconAnchor: [0, 12]
        })
    });
    
    // Add the label marker to the map
    labelMarker.addTo(map);
}

// Add interactivity to zones with PDFs
function addZoneInteractivity(feature, layer) {
    layer.on('click', () => window.open(`pdf/${feature.properties.url}`, '_blank'));
    layer.on('mouseover', function() {
        layer.setStyle({ fillOpacity: 0.8 });
        layer._path.style.cursor = 'pointer';
    });
    layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.6 }));
}

// Helper function to convert string to title case
function toTitleCase(str) {
    return str.replace(/([A-Z])/g, ' $1')
        .replace(/^./, function(str) { return str.toUpperCase(); })
        .replace(/([A-Z])/g, function(match, p1) {
            return ' ' + p1;
        })
        .trim();
}// Show/hide loading indicator
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

// Update your loadData function
function loadData() {
    showLoading();
    
    loadBoundary()
        .then(() => {
            // Load other layers in parallel after boundary is loaded
            return Promise.all([
                loadLayer('buildings', 'data/buildings.geojson', STYLES.buildings, true),
                loadLandmarks(),
                loadLayer('surveyLines', 'data/surv.geojson', { style: STYLES.surveyLines }, true),
                loadLayer('parks', 'data/parks_filtered.geojson', { style: STYLES.parks }, true),
                loadPhotos(),
                loadCRNodes(),
                loadDetailedZones()
            ]);
        })
        .catch(error => {
            console.error('Error loading map data:', error);
        })
        .finally(() => {
            hideLoading();
        });
}