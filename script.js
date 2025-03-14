// Set your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoiZ2xhc2VyamEiLCJhIjoiY201b2RybzhxMGt5ZDJrcTFoYWhuZGg1NSJ9.26_93f6771_YWY9BhIhnlw";

// Initialize the Mapbox map
const map = new mapboxgl.Map({
    container: "my-map",
    style: "mapbox://styles/glaserja/cm72c3cvb007u01s31k928na5",
    center: [-79.39, 43.66], // Toronto coordinates
    zoom: 12
});

// Adds navigation controls (zoom and rotation)
map.addControl(new mapboxgl.NavigationControl());

// Current filter type
let currentFilter = "all"; // Can be "all", "fatal", or "nonfatal"

// Sets default slider value to 2023 when the page first loads
document.addEventListener("DOMContentLoaded", function () {
    let defaultYear = 2023;
    document.getElementById("year-slider").value = defaultYear;
    document.getElementById("selected-year").textContent = defaultYear;
});

// Load map layers
map.on("load", () => {
    // Load bike route data
    map.addSource("bike-routes", {
        type: "geojson",
        data: "https://glaserja5.github.io/Lab-2-GGR472/data/bikeroutes.geojson"
    });

    // Load crash data from Mapbox tileset
    map.addSource("toronto-crash-data", {
        type: "vector",
        url: "mapbox://glaserja.1s8ixfae"
    });

    // Add bike lane layer
    map.addLayer({
        id: "bike-routes-layer",
        type: "line",
        source: "bike-routes",
        layout: {
            "line-join": "round",
            "line-cap": "round"
        },
        paint: {
            "line-color": "#007cbf",
            "line-width": 3
        }
    });

    // Load cyclist bike icon from GitHub
    map.loadImage(
        "https://raw.githubusercontent.com/glaserja5/Lab-2-GGR472/main/bike-svgrepo-com.png",
        (error, image) => {
            if (error) throw error;
            map.addImage("cyclist-icon", image);

            // Add crash points layer
            map.addLayer({
                id: "toronto-crash-layer",
                type: "symbol",
                source: "toronto-crash-data",
                "source-layer": "TOTAL_KSI_-443861647161779187-ade2h2",
                layout: {
                    "icon-image": "cyclist-icon",
                    "icon-size": [
                        "interpolate", ["linear"], ["zoom"],
                        8, 0.01,
                        10, 0.03,
                        12, 0.06,
                        14, 0.1,
                        16, 0.15,
                        18, 0.25
                    ],
                    "icon-allow-overlap": true
                }
            });

            // ✅ Apply the default filter when the map loads
            filterCrashes();
        }
    );
// initiate pop up for crash items
    map.on("click", "toronto-crash-layer", (e) => {
        const properties = e.features[0].properties;
    
        // Extract and format new properties and add icons for decoration
        const alcoholInvolved = properties.ALCOHOL === "Yes" ? "✅ Yes" : "❌ No";
        const aggravatedDriving = properties.AG_DRIV === "Yes" ? "✅ Yes" : "❌ No"; // Alcohol and AGDrive data is boolean
    
        const popupContent = `
            <div class="popup-content">
                <strong>🚴 Crash Summary</strong><br>
                <b>📍 Location:</b> ${properties.ACCLOC || "Unknown"}<br>
                <b>💥 Impact Type:</b> ${properties.IMPACTYPE || "Unknown"}<br>
                <b>⚖️ Accident Class:</b> ${properties.ACCCLASS || "Unknown"}<br>
                <b>📅 Date:</b> ${properties.DATE || "Unknown"}<br>
                <b>🍺 Alcohol Involved:</b> ${alcoholInvolved}<br>
                <b>🚨 Aggravated Driving:</b> ${aggravatedDriving}
            </div>
        `;

        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(map);
    });    

    // Change cursor type when hovering over crash points
    map.on("mouseenter", "toronto-crash-layer", () => {
        map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "toronto-crash-layer", () => {
        map.getCanvas().style.cursor = "";
    });
});

// Function to filter crashes by year and fatal/non-fatal category
function filterCrashes() {
    let selectedYear = document.getElementById("year-slider").value;
    let filter = ["all"];

    // Extract year from DATE
    const extractedYear = ["slice", ["get", "DATE"], 12, 16]; // this data is stored wierd but 
    // slice like a string to get the year because dates are stored like in 29 character strings
    filter.push(["==", ["to-number", extractedYear], parseInt(selectedYear)]);

    // Apply additional filters for fatal/non-fatal crashes
    if (currentFilter === "fatal") {
        filter.push(["==", ["get", "ACCLASS"], "Fatal"]);
    } else if (currentFilter === "nonfatal") {
        filter.push(["==", ["get", "ACCLASS"], "Non-Fatal Injury"]);
    }

    // Apply filter to crash layer
    map.setFilter("toronto-crash-layer", filter);

    // This line lets Mapbox finish rendering before updating the crash count in legend
    // Otheriwse the count is unresponsive to filter change
    map.once("idle", () => {
        updateCrashCount();
    });
}

function updateCrashCount() {
    // Get current year from slider
    let selectedYear = document.getElementById("year-slider").value;
    // create filter for the selected year by indexing date from string and check if year natches slider year
    let countFilter = ["all", ["==", ["to-number", ["slice", ["get", "DATE"], 12, 16]], parseInt(selectedYear)]];

    // checks that only filtered crash type is counted
    if (currentFilter === "fatal") {
        countFilter.push(["==", ["get", "ACCLASS"], "Fatal"]);
    } else if (currentFilter === "nonfatal") {
        countFilter.push(["==", ["get", "ACCLASS"], "Non-Fatal Injury"]);
    }

    // Query only the visible features in the crash layer based on countFilter
    let features = map.queryRenderedFeatures({ layers: ["toronto-crash-layer"], filter: countFilter });

    // Update legend text dynamically
    let crashCount = features.length;
    document.getElementById("total-crashes").textContent = crashCount;
}

document.getElementById("year-slider").addEventListener("input", function () {
    let selectedYear = this.value;

    // Update the selected year in both elements
    document.getElementById("selected-year").textContent = selectedYear;
    document.getElementById("selected-year-text").textContent = selectedYear; // This line updates the legend year!

    // Apply the filter dynamically
    filterCrashes();
    updateCrashCount(); // Ensure count updates immediately
});

// BUTTON EVENT LISTENERS (Toggle Fatal/Non-Fatal)
document.getElementById("show-all").addEventListener("click", function () {
    currentFilter = "all";
    setActiveButton("show-all");
    filterCrashes();
});

document.getElementById("show-fatal").addEventListener("click", function () {
    currentFilter = "fatal";
    setActiveButton("show-fatal");
    filterCrashes();
});

document.getElementById("show-nonfatal").addEventListener("click", function () {
    currentFilter = "nonfatal";
    setActiveButton("show-nonfatal");
    filterCrashes();
});

// Function to highlight active button
function setActiveButton(activeId) {
    document.querySelectorAll(".filter-buttons button").forEach(btn => btn.classList.remove("active"));
    document.getElementById(activeId).classList.add("active");
}