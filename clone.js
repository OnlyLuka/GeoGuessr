'use strict';

const MAPILLARY_CLIENT_TOKEN = 'MLY|30659072840403619|361263956c0aac664f5a7475a63df437';

let map, resultmap, guessMarker, trueMarker, guess_coordinates = [], true_location = [];
let accumulated_distance = 0, current_name = '', distance_from_guess = 0, check_count = 0;
let panoViewer;
let currentLang = 'en'; // default language

// Chargement dynamique de la liste d'IDs Mapillary
let MAPILLARY_IMAGES = [];

function fetchMapillaryIDs() {
    return fetch('mapillary_ids.json')
        .then(resp => resp.json())
        .then(ids => {
            MAPILLARY_IMAGES = ids;
        });
}

// ... (tes traductions et le reste inchangés)

const translations = {
    en: {
        title: "TerraSpot Project!",
        guess: "Guess!",
        next: "Next Location",
        correct: "Correct Location:",
        yourGuess: "Your Guess was",
        away: "away",
        roundScore: "Round Score:",
        miles: "Miles",
        km: "km",
        english: "English",
        french: "Français",
        error_loading: "Sorry, no valid Mapillary image found. Try refreshing the page."
    },
    fr: {
        title: "TerraSpot Projet!",
        guess: "Valider",
        next: "Lieu suivant",
        correct: "Bonne position :",
        yourGuess: "Votre estimation était à",
        away: "de distance",
        roundScore: "Score du tour :",
        miles: "Miles",
        km: "km",
        english: "English",
        french: "Français",
        error_loading: "Désolé, aucune image Mapillary valide trouvée. Essayez de rafraîchir la page."
    }
};

function getRandomMapillaryImage(tried = []) {
    if (tried.length >= MAPILLARY_IMAGES.length) return null;
    let idx;
    do {
        idx = Math.floor(Math.random() * MAPILLARY_IMAGES.length);
    } while (tried.includes(MAPILLARY_IMAGES[idx]));
    return MAPILLARY_IMAGES[idx];
}

async function getRandomValidLocation() {
    let tried = [];
    while (tried.length < MAPILLARY_IMAGES.length) {
        const imageId = getRandomMapillaryImage(tried);
        tried.push(imageId);
        const url = `https://graph.mapillary.com/${imageId}?fields=id,computed_geometry&access_token=${MAPILLARY_CLIENT_TOKEN}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.computed_geometry && data.computed_geometry.coordinates) {
                const coords = data.computed_geometry.coordinates;
                return {
                    lat: coords[1],
                    lng: coords[0],
                    imageId: imageId
                };
            }
        } catch (e) {
            // continue
        }
    }
    return null; // rien trouvé
}

async function initialize() {
    check_count = 0;
    disableButton('check');
    hideButton('next');
    if (accumulated_distance === 0) {
        document.getElementById("totaldistance").innerHTML = `${tr('roundScore')} 0 ${tr(unit())}`;
    }
    document.getElementById("location").innerHTML = ' ';
    document.getElementById("distance").innerHTML = ' ';
    document.getElementById("result").innerHTML = '';

    const randomLoc = await getRandomValidLocation();
    if (!randomLoc) {
        document.getElementById("result").innerHTML = `<div style="color:red; font-weight:bold; text-align:center;">${tr('error_loading')}</div>`;
        return;
    }

    true_location = [randomLoc.lat, randomLoc.lng];
    current_name = `${randomLoc.lat.toFixed(2)}, ${randomLoc.lng.toFixed(2)}`;

    if (panoViewer) panoViewer.remove();
    panoViewer = new Mapillary.Viewer({
        container: 'pano',
        imageId: randomLoc.imageId,
        accessToken: MAPILLARY_CLIENT_TOKEN,
        component: { cover: false }
    });

    if (map) map.remove();
    map = L.map('map').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (guessMarker) { map.removeLayer(guessMarker); guessMarker = null; }
    guess_coordinates = [];

    map.on('click', function (e) {
        if (guessMarker) map.removeLayer(guessMarker);
        guessMarker = L.marker(e.latlng).addTo(map);
        guess_coordinates = [e.latlng.lat, e.latlng.lng];
        if (check_count === 0) {
            enableButton('check');
            check_count += 1;
        }
    });

    if (resultmap) resultmap.remove();
    resultmap = L.map('result').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(resultmap);
    if (trueMarker) { resultmap.removeLayer(trueMarker); trueMarker = null; }

    updateTexts();
}

// ... (le reste de ton code inchangé : check, calcDistance, display_location, boutons, langues, etc.)

// Remplace le DOMContentLoaded par ce bloc pour charger la liste d'abord :
window.addEventListener('DOMContentLoaded', () => {
    hideButton('next');
    disableButton('check');
    document.getElementById("lang-btn").innerHTML = "EN ⯆";
    fetchMapillaryIDs().then(initialize);
});