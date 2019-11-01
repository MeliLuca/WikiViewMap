
$(document).ready(function () {
    //////// variabili per il programma
    () => {
        if (window.localStorage.expired == undefined || new Date().getTime() > window.localStorage.expired) window.location.replace('login.html');
    }

    const URL_server = 'http://wvm.dais.unive.it:8080';
    //const URL_server = 'http://localhost:8080';
    var latlng;

    /////// variabili per la creazione della mappa
    var options = {
        pathOptions: {
            // add leaflet options for polylines/polygons
            fillOpacity: 0.1,
        },
    };
    var mapGroup = L.featureGroup();
    var mappa = {
        "Streets": L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox.streets',
            accessToken: 'pk.eyJ1IjoibWVsaTEyIiwiYSI6ImNqeDVydTMzZTA1NDU0M2wxemI1YTRuNzcifQ.QhsY0a9XLTO_fD_my29HgQ'
        }),
        "Satellite": L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox.satellite',
            accessToken: 'pk.eyJ1IjoibWVsaTEyIiwiYSI6ImNqeDVydTMzZTA1NDU0M2wxemI1YTRuNzcifQ.QhsY0a9XLTO_fD_my29HgQ'
        })
    };
    var mymap = L.map('mapid', {
        layers: [mappa.Streets],
        measureControl: true,
        drawControl: true
    });
    L.control.layers(mappa).addTo(mymap);
    mymap.setView([45, 12], 3);

    $('#send_data').click(function () {
        console.log('premuto')
        let city = $('#city').val();
        let lang = $('#lang').val();
        console.log(city + ' ' + lang)
        if (city == '' || lang == '') alert('compila tutti i dati mancanti')
        else {
            $.ajax({
                url: URL_server + '/newCity?city=' + city + '&lang=' + lang,
                method: 'POST',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('Authorization', 'Bearer ' + window.localStorage.token.replace(/"/g, ""));
                },
                data: { bbox: latlng }
            }).then(res => {
                alert(res)
                latlng = [];
            }).catch(err => {
                if (err.status == '401') window.location.replace('login.html')
                else {
                    console.log(err)
                    alert(err.text)
                }
            })
        }
    });

    $('#bbox').click(function () {
        let catch_latlng = []
        mymap.pm.enableDraw('Rectangle', options, {
            snappable: true,
            //snapDistance: 20,
        });
        function catchCoord(ev) {
            catch_latlng.push(mymap.mouseEventToLatLng(ev.originalEvent));
            if (catch_latlng.length >= 2) {
                mymap.off('click', catchCoord);
                latlng = JSON.stringify(catch_latlng)
                console.log(latlng)
                $('#cercaBox').prop('disabled', true);
            }
        }
        mymap.on('click', catchCoord);
    });

    $('#reset').click(function () {
        mapGroup.clearLayers()
        $('#city').val('');
        $('#lang').val('');

        latlng = [];
        mymap.setView([45, 12], 3);
    })

    function catch_coord(bbox) {
        return [[
            [bbox[1].lng, bbox[1].lat],
            [bbox[1].lng, bbox[0].lat],
            [bbox[0].lng, bbox[0].lat],
            [bbox[0].lng, bbox[1].lat]
        ]]
    }

    $('#show_data').click(function () {
        mapGroup.clearLayers();
        $.ajax({
            url: URL_server + '/infodb',
            method: 'GET',
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Authorization', 'Bearer ' + window.localStorage.token.replace(/"/g, ""));
            }
        }).then(data => {
            $('#delete_city').attr('hidden', false);
            $('#name_city').attr('hidden', false);
            console.log(data)
            let geoObj = data.map(x => {
                return {
                    "type": "Feature",
                    "properties": {
                        "popupContent": "name: " + x.city + "<br>number of Points: " + x.tot_pnt + "<br>lang to research: " + x.lang,
                    },
                    "geometry": {
                        "type": x.bbox == 'null' ? 'Point' : 'Polygon',
                        "coordinates": x.bbox == 'null' ? [x.coordinates.lon, x.coordinates.lat] : catch_coord(x.bbox),
                    }
                }
            })
            console.log(geoObj)
            L.geoJSON(geoObj, {
            }).bindPopup(function (layer) {
                return layer.feature.properties.popupContent;
            }).addTo(mapGroup);
            mymap.addLayer(mapGroup)
            //show_data(data)
        }).catch(err => {
            console.log(err)
        })
    })
    $('#delete_city').click(function () {
        let name = $('#name_city').val()
        if (name == '') alert('inserisci il nome di una città che si deridera eliminare')
        else {
            $.ajax({
                url: URL_server + '/delete?city='+name,
                method: 'GET',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('Authorization', 'Bearer ' + window.localStorage.token.replace(/"/g, ""));
                }
            })
            .then(res =>{
                mapGroup.clearLayers();
                $('#show_data').click();
            })
            .catch(err =>{
                alert('errore nella cancellazione della città. Verifica che il nome sia corretto')
            })
        } 
    })
});