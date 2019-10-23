$(document).ready(function () {
    //////// variabili per il programma
    const URL_server = 'http://wvm.dais.unive.it:8080';
    //const URL_server = 'http://localhost:8080';
    $('#submit').click(function () {
        let username = $('#inputEmail').val();
        let password = $('#inputPassword').val();
        $.ajax({
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password),
            },
            url: URL_server + '/login',
            method: 'GET',
            dataType: 'jsonp'
        }).then(res => {
            window.localStorage.token = JSON.stringify(res.token);
            window.localStorage.expired = JSON.stringify(res.expired);
            console.log('ok')
            window.location.replace('admin.html');
        }).catch(err => {
            alert(err)
            console.log(err)
        })
    });
});