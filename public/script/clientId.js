function getClientId() {
    if (sessionStorage.getItem('id') == null) {
        let res = '' + Math.random() + Math.random() + Math.random() + Math.random();
        res = res.split('.').join('');
        sessionStorage.setItem('id', res)
    }
    return sessionStorage.getItem('id');
}