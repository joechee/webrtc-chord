function setChannelEvents(channel, channelNameForConsoleOutput) {
    console.debug('protocol of', channelNameForConsoleOutput, 'is', channel.protocol);
    channel.onmessage = function (event) {
        console.debug(channelNameForConsoleOutput, 'received a message:', event.data);
    };
    channel.onopen = function () {
        channel.send('first text message over SCTP data ports');
    };
    channel.onclose = function (e) {
        console.error(e);
    };
    channel.onerror = function (e) {
        console.error(e);
    };
}

function useless() {}

var iceServers = {
    iceServers: [{
            url: 'stun:23.21.150.121'
        }
    ]
};

var offerer = new mozRTCPeerConnection(iceServers),
    answerer, answererDataChannel, offererDataChannel;

offererDataChannel = offerer.createDataChannel('channel', {});
setChannelEvents(offererDataChannel, 'offerer');

offerer.createOffer(function (sessionDescription) {
    offerer.setLocalDescription(sessionDescription);
    createAnswer(sessionDescription);
}, null, mediaConstraints);


var mediaConstraints = {

};

function createAnswer(offerSDP) {
    answerer = new mozRTCPeerConnection(iceServers);
    answerer.ondatachannel = function (event) {
        answererDataChannel = event.channel;
        setChannelEvents(answererDataChannel, 'answerer');
    };


    answerer.setRemoteDescription(offerSDP);

    answerer.createAnswer(function (sessionDescription) {
        answerer.setLocalDescription(sessionDescription);

        offerer.setRemoteDescription(sessionDescription);
    }, null, mediaConstraints);

}