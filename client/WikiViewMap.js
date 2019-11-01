
$(document).ready(function () {
    var recive_points = [];
    var request_bbox = undefined;
    const URL_server = 'http://wvm.dais.unive.it:8080';
    //const URL_server = 'http://localhost:8080';
    var countViewsGroup = L.featureGroup();
    var bboxViewsGroup = L.featureGroup();
    const layers = [countViewsGroup, bboxViewsGroup]
    // inizializzo la mappa per la visualizzazioine dei points
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
        measureControl: true
    });
    L.control.layers(mappa).addTo(mymap);
    mymap.setView([45, 12], 3);
    mymap.pm.setLang('it');

    var options = {
        pathOptions: {
            // add leaflet options for polylines/polygons
            fillOpacity: 0.0,
        },
    };

    var legend = L.control({ position: 'bottomright' });
    legend.onAdd = function (mymap) {
        var div = L.DomUtil.create('div', 'info legend'),
            grades = [0, 100, 1000, 10000],
            labels = [];
        div.innerHTML += '<h6>Lingue per pagina </h6>'
        // loop through our density intervals and generate a label with a colored square for each interval
        for (var i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<i style="background:' + getColor(grades[i]) + '"></i> ' +
                grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
        }
        return div;
    };
    var info = L.control();
    info.onAdd = function (mymap) {
        this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
        return this._div;
    };

    // inserisce le città presenti nel database nel downscroll
    function getCitiesList() {
        $.ajax({
            url: URL_server + '/citiesList',
            method: 'GET'
        }).done((data, err) => {
            if (err) console.log(err);
            for (let i = 0; i < data.length; i++) {
                let city = data[i];
                $('#select-city').append('<option value=' + city + '> ' + city + '</a>');
            }
        })
    }
    getCitiesList();


    function getColor(d) {
        return d < 100 ? '#ff9999' :
            d < 1000 ? '#d81818' :
                d < 10000 ? '#a61414' :
                    '#780e0e';
    }


    // method that we will use to update the control based on feature properties passed
    /*  info.update = function (props) {
         this._div.innerHTML = '<h5>Lingue per pagina </h5>';
     }; */


    /*  var viewBox = function (bbox) {
         let lowerB = { lat: bbox[0].lat, lon: bbox[0].lng }
         let upperB = { lat: bbox[1].lat, lon: bbox[1].lng }
         let box = [];
         for (let i = 0; i < recive_points.length; i++) {
             let tmp = recive_points[i], lat = parseFloat(recive_points[i].lat), lon = parseFloat(recive_points[i].lon);
             if (lat <= lowerB.lat && lat >= upperB.lat && lon >= lowerB.lon && lon <= upperB.lon) {
                 box.push(tmp);
             }
         }
         viewCountData(box)
     } */

    /*  var getMostviews = function(page, views){
         for(let i=0; i< mostViews.length; i++){
 
         }
     } */

    var createCircle = function (info) {
        return L.circle([info.lat, info.lon], {
            color: info.color,
            opacity: 0.7,
            fillColor: info.color,
            //fillOpacity: 0.2,
            radius: info.radius
        })
    }
    var viewCountData = function (points) {
        bboxViewsGroup.clearLayers();
        countViewsGroup.clearLayers();
        for (let pnt of points) {
            let totViews = pnt.views
            let col = getColor(totViews);
            let rad = totViews < 100 ? 4 : totViews < 1000 ? 8 : totViews < 10000 ? 10 : 15;
            let circle = createCircle(
                { lat: pnt.lat, lon: pnt.lon, color: col, radius: rad }
            ).addTo(countViewsGroup);
            let content = "<b>" + pnt.title + " : " + totViews + "</b>";
            circle.bindPopup(content);
        }
        mymap.addLayer(countViewsGroup);
        legend.addTo(mymap);
        info.addTo(mymap);
    }
    // modifiche utilizzando mongodb
    /*     function show_response(data) {
            recive_points = data;
            mymap.setView([recive_points[0].lat, recive_points[0].lon], 12);
            $('#bbox').prop('disabled', false);
            $('#filter_by_sum').attr('max', recive_points[0].sum);
            $('#filter_by_sum').attr('step', 1000);
            console.log(recive_points[0].sum)
            viewCountData(recive_points)
        } */
    function show_response(recive_points) {
        mymap.setView([recive_points[0].lat, recive_points[0].lon], 12);
        $('#bbox').prop('disabled', false);
        console.log(recive_points[0])
        $('#filter_by_sum').attr('max', recive_points[0].views);
        let sum = recive_points.reduce((accumulator, currentValue)=>{return accumulator + currentValue.views}, 0)
        let avg = parseInt(sum / recive_points.length , 10)
        $('#filter_by_sum').attr('step', avg);
        $('#dropdownDownload').attr('hidden', false);
        viewCountData(recive_points)
    }

    $('#ricevi-dati').click(function () {
        countViewsGroup.clearLayers();
        bboxViewsGroup.clearLayers();
        let city = $('.custom-select').val()
        let lang = $('#lingua').val()
        let dataInizio = $('#dataInizio').val()
        let dataFine = $('#dataFine').val()
        // console.log(request_bbox)
        console.log(city + ' ' + lang + ' ' + dataInizio + ' ' + dataFine)
        $.ajax({
            url: URL_server + '/views?city=' + city + "&lang=" + lang + "&dataInizio=" + dataInizio + "&dataFine=" + dataFine + "",
            method: 'GET',
            data: {
                bbox: request_bbox
            }
        }).then(res => {
            console.log(res)
            request_bbox = undefined;
            let filename = "views_" + city + "_" + lang + "_" + dataInizio + "_" + dataFine;
            download(filename, res);
            show_response(res);
        }).catch(err => {
            console.log(err);
            alert('Abbiamo ricevuto un errore, ricarica la pagina')
        })
    })

    $('#bbox').click(function () {
        let latlng = [];
        mymap.pm.enableDraw('Rectangle', options, {
            snappable: true,
            //snapDistance: 20,
        });
        function catchCoord(ev) {
            latlng.push(mymap.mouseEventToLatLng(ev.originalEvent));
            if (latlng.length >= 2) {
                mymap.off('click', catchCoord);
                request_bbox = JSON.stringify(latlng)
            }
        }
        mymap.on('click', catchCoord);
    })


    $('#filter_by_sum').click(function () {
        console.log($('#filter_by_sum').val())
        $('#testo_range').innerHTML = 'visite maggiori di ' + $('#filter_by_sum').val()
        let filter_points = recive_points.filter(x => {
            return x.views >= $('#filter_by_sum').val()
        })
        console.log(filter_points.length)
        viewCountData(filter_points)
    })

    $('#login').click(function () {
        // controlla se il token è ancora valido
        let today = new Date();
        if (today.getTime() < window.localStorage.expired) window.location.replace('admin.html');
        else window.location.replace('login.html')
    })

    $('#clear').click(function(){
        // problemi con l'eliminazione degli elementi inseriti tramite lealfet.pm
        window.location.reload()
    })

    function download(filename, data) {
        let csv_filename = filename + ".csv";
        let csv = '';
        let header = Object.keys(data[0]).join(',');
        let values = data.map(o => Object.values(o).join(',')).join('\n');
        csv += header + '\n' + values;
        $('#csvDownload').attr('href', 'data:csv/plain;charset=utf-8,' + encodeURIComponent(csv));
        $('#csvDownload').attr('download', csv_filename);

        let json_filename = filename + ".json";
        $('#jsonDownload').attr('href', 'data:json/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(data)));
        $('#jsonDownload').attr('download', json_filename);
    }
})