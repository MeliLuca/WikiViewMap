$(document).ready(function () {
    //////// variabili per il programma
    const URL_server = 'http://wvm.dais.unive.it:8080';
    $('#submit').click(function () {
        let username = $('#inputEmail').val();
        let password = $('#inputPassword').val();
        console.log('dio cane porco ido merda')
        $.ajax({
            xhrFields: {
                withCredentials: true
            },
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password),
            },
            url: URL_server + '/login',
            method: 'GET',
            dataType: 'jsonp'
        }).then(res => {
            alert('dio semo come a merda')
            window.localStorage.token = JSON.stringify(res.token);
            window.localStorage.expired = JSON.stringify(res.expired);
            console.log('dio brutto porco di merda dio cane porco dio merda')
            alert('dio somareo di merda porco ido finocchio')
            window.location.replace('admin.html');
        }).catch(err => {
            alert(err)
            console.log(err)
        })
    });
});