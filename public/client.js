const localVideo = document.getElementById("local_video");

const peerConnections = {};
let peerUserNames = [];

const socket = io();
const clientId = getClientId();

let localStream;
let screenStream;
let roomId;

const stunServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
    ],
};

const mediaStreamConfig = {
    audio: true,
    video: true,
};

socket.on("full_room", (room) => {
    alert("Room " + room + " is full");
});

socket.on("ready", async (socketId, name) => {
    const peerConnection = new RTCPeerConnection(stunServers);
    peerConnections[socketId] = peerConnection;
    peerUserNames[socketId] = name;
    peerConnection.addStream(localVideo.srcObject);
    const offer = await peerConnection.createOffer();
    peerConnection
        .setLocalDescription(offer)
        .then(() =>
            socket.emit(
                "offer",
                socketId,
                peerConnection.localDescription,
                clientId
            )
        );

    peerConnection.onaddstream = (event) => {
        remoteStreamAddHandler(event.stream, socketId);
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("candidate", socketId, event.candidate);
        }
    };
});

socket.on("offer", (socketId, description, name) => {
    const peerConnection = new RTCPeerConnection(stunServers);
    peerConnections[socketId] = peerConnection;
    peerUserNames[socketId] = name;
    peerConnection.addStream(localVideo.srcObject);
    peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
            socket.emit("answer", socketId, peerConnection.localDescription);
        });

    peerConnection.onaddstream = (event) =>
        remoteStreamAddHandler(event.stream, socketId);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("candidate", socketId, event.candidate);
        }
    };
});

socket.on("answer", (id, description) => {
    peerConnections[id].setRemoteDescription(description);
});

socket.on("candidate", (id, candidate) => {
    peerConnections[id]
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((e) => console.error(e));
});

socket.on("end", (socketId) => {
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
        $(`#${socketId}`).remove();
    }
});

socket.on("send_message", (senderName, message) => {
    const date = new Date(Date.now());
    let hour = date.getHours();
    if (("" + hour).length === 1) {
        hour = "0" + hour;
    }

    let minute = date.getMinutes();
    if (("" + minute).length === 1) {
        minute = "0" + minute;
    }

    const dateStr = `${hour}:${minute}`;

    const messageEl = $("<div></div>")
        .addClass("income_message")
        .append(
            $("<div></div>")
                .addClass("message")
                .addClass("income_message_inner")
                .append(
                    $("<div></div>").addClass("sender_name").text(senderName)
                )
                .append(
                    $("<div></div>").addClass("message_content").text(message)
                )
                .append(
                    $("<div></div>")
                        .addClass("time-container")
                        .append(
                            $("<p></p>").addClass("message_time").text(dateStr)
                        )
                )
        );
    $(".messages").append(messageEl);
    console.log(message);
});

window.onunload = async () => {
    await fetch(`/end_session?uid=${clientId}`, {
        method: "POST",
    });
    socket.close();
};

function remoteStreamAddHandler(stream, socketId) {
    const remoteVideo = document.createElement("video");
    remoteVideo.classList.add("remote_video");
    remoteVideo.srcObject = stream;
    remoteVideo.setAttribute("playsinline", "true");
    remoteVideo.setAttribute("autoplay", "true");

    const userName = $("<span></span>")
        .addClass("video_client_name")
        .text(peerUserNames[socketId]);

    const wholeEl = $("<div></div>")
        .addClass("remote_video_el")
        .attr("id", socketId)
        .append(remoteVideo)
        .append(userName);
    $("#remote_videos").append(wholeEl);
}

async function start() {
    let res = await fetch(`/get_room_id?uid=${clientId}`, {
        method: "GET",
    });
    res = await res.json();
    roomId = res.id;
    socket.emit("join", clientId);
    localVideo.srcObject = localStream =
        await navigator.mediaDevices.getUserMedia(mediaStreamConfig);
    localVideo.play();
    socket.emit("ready", clientId);
}

start();

function changeVideoStatus() {
    /*     if (localVideo.getVideoTracks == null) {
        alert("Video camera wasn't found on your device");
        return;
    } */
    localVideo.srcObject.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log(track);
    });

    $("#video_status")
        .toggleClass("video_status_disabled")
        .toggleClass("video_status_enabled");
}

function changeAudioStatus() {
    localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        console.log(track);
    });

    $("#audio_status")
        .toggleClass("audio_status_disabled")
        .toggleClass("audio_status_enabled");
}

async function demonstrateScreen() {
    let currentStream;

    if (localVideo.srcObject === localStream) {
        currentStream = await navigator.mediaDevices.getDisplayMedia(
            mediaStreamConfig
        );
    } else {
        currentStream = localStream;
    }

    for (const [, val] of Object.entries(peerConnections)) {
        val.getSenders().forEach((sender) => {
            console.log("" + sender + "   " + sender.track);
            if (sender.track.kind === "video") {
                sender.replaceTrack(currentStream.getVideoTracks()[0]);
            }
        });
    }

    localVideo.srcObject = currentStream;
    localVideo.play();
}

function copyIdToClipboard() {
    let tmpInput = document.createElement("input");
    // tmpInput.style.display = 'none';
    document.body.appendChild(tmpInput);
    tmpInput.setAttribute("id", "dummy_id");
    document.getElementById("dummy_id").value = roomId;
    tmpInput.select();
    document.execCommand("copy");
    document.body.removeChild(tmpInput);

    setTimeout(() => {
        $("#get_room_btn").popover("hide");
    }, 2000);
}

function closeChat() {
    $(".main_chat").hide(DEFAULT_ANIMATION_TIMEOUT);
    $(".main_video").css("width", "100%");
    $(".main_buttons").css("width", "100%");
    $(".main_buttons").css("margin-left", "0");
}

function chatButtonClickHandler() {
    if ($(".main_chat").css("display") === "none") {
        $(".main_chat").show(DEFAULT_ANIMATION_TIMEOUT);
        $(".main_video").css("width", "75%");
        $(".main_buttons").css("width", "75%");
        $(".main_buttons").css("margin-left", "25%");
    } else {
        closeChat();
    }
}

async function leaveRoom() {
    await fetch(`/end_session?uid=${clientId}`, {
        method: "POST",
    });
    socket.close();
    window.location.replace("/");
}

function sendMessage() {
    let message = $("#chat-input").val();
    if (!message || message === "") {
        return;
    }
    socket.emit("send_message", clientId, message);

    const date = new Date(Date.now());
    let hour = date.getHours();
    if (("" + hour).length === 1) {
        hour = "0" + hour;
    }

    let minute = date.getMinutes();
    if (("" + minute).length === 1) {
        minute = "0" + minute;
    }

    const dateStr = `${hour}:${minute}`;
    // let dateStr = '19:55';
    const timeEl = $("<div></div>")
        .addClass("time-container")
        .append($("<p></p>").addClass("message_time").text(dateStr));

    const messageEl = $("<div></div>")
        .addClass("my_message")
        .append(
            $("<div></div>")
                .addClass("message")
                .addClass("my_message_inner")
                .append($("<div></div>").addClass("sender_name").text("You"))
                .append(
                    $("<div></div>").addClass("message_content").text(message)
                )
                .append(
                    $("<div></div>")
                        .addClass("time-container")
                        .append(
                            $("<p></p>").addClass("message_time").text(dateStr)
                        )
                )
        );

    $("#chat-input").val("");
    $(".messages").append(messageEl);
}
