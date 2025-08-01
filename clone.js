'use strict';

// Mapillary API token gratuit
const MAPILLARY_CLIENT_TOKEN = 'MLY|YOUR_MAPILLARY_TOKEN_HERE';

let map, resultmap, guessMarker, trueMarker, guess_coordinates = [], true_location = [];
let accumulated_distance = 0, current_name = '', distance_from_guess = 0, check_count = 0;
let panoViewer;
let currentLang = 'en'; // default language

// Traductions
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
        french: "Français"
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
        french: "Français"
    }
};

const MAPILLARY_IMAGES = [
    "524494585692477", "1265455672054374", "664790282220317", "1184842093228185"
];

function getRandomMapillaryImage() {
    return MAPILLARY_IMAGES[Math.floor(Math.random() * MAPILLARY_IMAGES.length)];
}
async function getRandomValidLocation() {
    const imageId = getRandomMapillaryImage();
    const response = await fetch(`https://graph.mapillary.com/${imageId}?fields=id,computed_geometry&access_token=${MAPILLARY_CLIENT_TOKEN}`);
    const data = await response.json();
    const coords = data.computed_geometry.coordinates;
    return {
        lat: coords[1],
        lng: coords[0],
        imageId: imageId
    };
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

    const randomLoc = await getRandomValidLocation();
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

function check() {
    enableButton('next');
    showButton('next');
    disableButton('check');
    // Calcul distance, selon la langue
    distance_from_guess = calcDistance(
        guess_coordinates[0], guess_coordinates[1],
        true_location[0], true_location[1]
    );
    accumulated_distance += parseFloat(distance_from_guess);

    if (trueMarker) resultmap.removeLayer(trueMarker);
    if (guessMarker) resultmap.removeLayer(guessMarker);
    trueMarker = L.marker(true_location).addTo(resultmap).bindPopup(tr('correct') + " " + current_name).openPopup();
    guessMarker = L.marker(guess_coordinates).addTo(resultmap).bindPopup(tr('yourGuess'));

    const polyline = L.polyline([guess_coordinates, true_location], {color: 'blue', dashArray: '5,10'}).addTo(resultmap);

    display_location();
}

function calcDistance(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    let R, factor;
    if (unit() === 'km') { R = 6371; factor = 1; }
    else { R = 6371; factor = 0.621371; }
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c * factor).toFixed(2);
}

function display_location() {
    document.getElementById("location").innerHTML = `${tr('correct')} ${current_name}`;
    document.getElementById("distance").innerHTML = `${tr('yourGuess')} ${distance_from_guess} ${tr(unit())} ${tr('away')}`;
    document.getElementById("totaldistance").innerHTML = `${tr('roundScore')} ${accumulated_distance.toFixed(2)} ${tr(unit())}`;
}

function disableButton(id) { document.getElementById(id).disabled = true; }
function enableButton(id) { document.getElementById(id).disabled = false; }
function showButton(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.style.display = "";
        btn.style.opacity = "1";
        btn.style.visibility = "visible";
    }
}
function hideButton(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.style.display = "none";
        btn.style.opacity = "0";
        btn.style.visibility = "hidden";
    }
}
function unit() {
    return currentLang === 'fr' ? 'km' : 'miles';
}
function tr(key) {
    return translations[currentLang][key] || key;
}

// ----- LANGUE -----
function toggleLangMenu() {
    const menu = document.getElementById("lang-menu");
    menu.style.display = (menu.style.display === "none" || !menu.style.display) ? "block" : "none";
}
function setLanguage(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    // Ferme le menu
    document.getElementById("lang-menu").style.display = "none";
    // Met à jour les textes
    updateTexts();
    // Réaffiche round/score/distance en bonne unité
    display_location();
    // Met à jour le bouton langue
    document.getElementById("lang-btn").innerHTML = (lang === "fr" ? "FR" : "EN") + " ⯆";
}
function updateTexts() {
    document.querySelector('h1').innerText = tr('title');
    document.getElementById('check').innerText = tr('guess');
    document.getElementById('next').innerText = tr('next');
    // Menu langues
    document.querySelectorAll('#lang-menu div')[0].innerText = translations['en'].english;
    document.querySelectorAll('#lang-menu div')[1].innerText = translations['fr'].french;
}

// Ferme le menu langue si on clique ailleurs
window.addEventListener('click', function(e) {
    const menu = document.getElementById("lang-menu");
    const btn = document.getElementById("lang-btn");
    if (!menu || !btn) return;
    if (!menu.contains(e.target) && e.target !== btn) {
        menu.style.display = "none";
    }
});

window.addEventListener('DOMContentLoaded', () => {
    hideButton('next');
    disableButton('check');
    document.getElementById("lang-btn").innerHTML = "EN ⯆";
    initialize();
});