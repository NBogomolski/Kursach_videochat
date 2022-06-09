const clientId = getClientId();

async function createHandler() {
    this.event.preventDefault();
    let nameEl = document.getElementById('room_create_name');

    let res = await fetch('/set_client_create_params', {
        method: 'POST',
        body: JSON.stringify({
            name: nameEl.value,
            uid: clientId
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (res.status === 400) {
        res = await res.json();
        handleErrorMessages(res);
        return
    }
    window.location.replace(`/connect?uid=${clientId}`)
}

async function joinHandler() {
    this.event.preventDefault();
    let idEl = document.getElementById('room_join_id');
    let nameEl = document.getElementById('room_join_name');

    let res = await fetch('/set_client_join_params', {
        method: 'POST',
        body: JSON.stringify({
            name: nameEl.value,
            uid: clientId,
            room: idEl.value
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (res.status === 400) {
        res = await res.json();
        handleErrorMessages(res);
        return
    }

    window.location.replace(`/connect?uid=${clientId}`)
}

function handleErrorMessages(res) {
    $('#alert_message').text(res.message);
    $('.alert').removeClass('hide').addClass('show');
    setInterval(() => {
        $('.alert').removeClass('show').addClass('hide')
    }, 50 * DEFAULT_ANIMATION_TIMEOUT)
}
